import asyncio
import json
from datetime import UTC, datetime, timedelta
from typing import Self

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import CursorResult, select, update
from sqlalchemy.orm import Session

from app.auth import current_user
from app.clock import Clock, get_clock
from app.db import get_db
from app.errors import InsufficientPaperCashError
from app.jsontypes import JSONDict
from app.market import get_provider
from app.market.base import MarketProvider
from app.models import Account, BuyPlan, Holding, StockNote
from app.portfolio import BookMode, book_mode_of, pay_for_paper_buy
from app.ratelimit import rate_limited
from app.safety.profile import LEVELS, QUESTIONS, level_from_answers
from app.safety.service import (
    ai_analysis,
    check_for,
    get_profile,
    portfolio_risk_report,
    profile_dict,
    save_profile,
    stock_safety,
    stress_report,
)
from app.schemas import CheckResultOut, PlanOut

router = APIRouter(tags=["safety"])


def _sym(s: str) -> str:
    return s.strip().upper()


# ---------------- risk profile ----------------


class ProfileIn(BaseModel):
    answers: dict[str, int] | None = None  # questionnaire; sets the level
    level: str | None = None  # or pick a level directly
    paper_mode: bool = True
    max_position_pct: float | None = Field(None, gt=0, le=100)
    max_sector_pct: float | None = Field(None, gt=0, le=100)
    min_safety_score: float | None = Field(None, ge=0, le=100)
    max_volatility_pct: float | None = Field(None, gt=0, le=300)
    max_drawdown_pct: float | None = Field(None, ge=-100, lt=0)
    min_market_cap_m: float | None = Field(None, ge=0)
    allow_penny_stocks: bool | None = None
    cooling_off_hours: int | None = Field(None, ge=0, le=720)

    @model_validator(mode="after")
    def _level_source(self) -> Self:
        if self.level is not None and self.level not in LEVELS:
            raise ValueError(f"level must be one of {LEVELS}")
        if self.answers is None and self.level is None:
            raise ValueError("send questionnaire answers or a level")
        return self


@router.get("/safety/questions")
def questions() -> JSONDict:
    return {"questions": QUESTIONS, "levels": LEVELS}


@router.get("/safety/profile")
def read_profile(user: str = Depends(current_user), db: Session = Depends(get_db)) -> JSONDict:
    return profile_dict(get_profile(db, user))


@router.put("/safety/profile")
def write_profile(body: ProfileIn, user: str = Depends(current_user), db: Session = Depends(get_db)) -> JSONDict:
    try:
        level = level_from_answers(body.answers) if body.answers is not None else body.level
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    if level is None:  # ProfileIn already requires one of them; keep the guarantee local
        raise HTTPException(422, "send questionnaire answers or a level")
    overrides = body.model_dump(exclude={"answers", "level", "paper_mode"})
    p = save_profile(db, user, level, body.answers or {}, overrides, body.paper_mode)
    return profile_dict(p)


# ---------------- stock safety & checks ----------------


@router.get("/stocks/{symbol}/safety", dependencies=[Depends(rate_limited("market"))])
async def safety(symbol: str, provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    return await stock_safety(provider, _sym(symbol))


@router.post("/stocks/{symbol}/safety/analyze", dependencies=[Depends(rate_limited("ai"))])
async def safety_analyze(symbol: str, user: str = Depends(current_user), db: Session = Depends(get_db), provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    """AI analyzer: explains each area grade and how the stock fits the user's risk rules."""
    return await ai_analysis(db, user, provider, _sym(symbol))


class CheckIn(BaseModel):
    symbol: str
    amount: float | None = Field(None, gt=0)
    quantity: float | None = Field(None, gt=0)
    mode: BookMode = "real"  # which book the money would go into

    @field_validator("symbol")
    @classmethod
    def _u(cls, v: str) -> str:
        return _sym(v)

    @model_validator(mode="after")
    def _one(self) -> Self:
        if (self.amount is None) == (self.quantity is None):
            raise ValueError("send exactly one of amount or quantity")
        return self


async def _amount(body: CheckIn, provider: MarketProvider) -> tuple[float, float]:
    price = (await provider.quote(body.symbol))["price"]
    if body.amount is not None:
        return body.amount, price
    if body.quantity is None:  # CheckIn already requires exactly one of them
        raise HTTPException(422, "send exactly one of amount or quantity")
    return body.quantity * price, price


@router.post("/safety/check", response_model=CheckResultOut)
async def safety_check(body: CheckIn, user: str = Depends(current_user), db: Session = Depends(get_db), provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    amount, price = await _amount(body, provider)
    out = await check_for(db, user, provider, body.symbol, amount, body.mode)
    out["price"] = price
    return out


@router.get("/safety/portfolio")
async def portfolio_risk(mode: BookMode = "real", user: str = Depends(current_user), db: Session = Depends(get_db), provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    return await portfolio_risk_report(db, user, provider, mode)


@router.get("/safety/stress")
async def stress(mode: BookMode = "real", user: str = Depends(current_user), db: Session = Depends(get_db), provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    return await stress_report(db, user, provider, mode)


# ---------------- buy plans: check → (note + cooling-off) → execute ----------------


class PlanIn(BaseModel):
    account_id: int
    symbol: str
    quantity: float = Field(gt=0)
    note: str = Field("", max_length=4000)

    @field_validator("symbol")
    @classmethod
    def _u(cls, v: str) -> str:
        return _sym(v)


def _plan_out(p: BuyPlan, now: datetime) -> JSONDict:
    avail = p.available_at if p.available_at.tzinfo else p.available_at.replace(tzinfo=UTC)
    status = p.status
    if status == "cooling_off" and avail <= now:
        status = "ready"
    return {
        "id": p.id, "account_id": p.account_id, "symbol": p.symbol, "quantity": p.quantity, "price": p.price,
        "amount": round(p.quantity * p.price, 2), "note": p.note, "verdict": p.verdict, "status": status,
        "available_at": avail.isoformat(), "created_at": p.created_at.isoformat(),
        "check": json.loads(p.check_json), "executed_holding_id": p.executed_holding_id,
    }


def _own_plan(db: Session, plan_id: int, user: str) -> BuyPlan:
    p = db.get(BuyPlan, plan_id)
    if not p or p.user_id != user:
        raise HTTPException(404, "plan not found")
    return p


@router.get("/plans", response_model=list[PlanOut])
def list_plans(user: str = Depends(current_user), db: Session = Depends(get_db), now: Clock = Depends(get_clock)) -> list[JSONDict]:
    rows = db.scalars(select(BuyPlan).where(BuyPlan.user_id == user).order_by(BuyPlan.created_at.desc()).limit(100)).all()
    return [_plan_out(p, now()) for p in rows]


@router.post("/plans", response_model=PlanOut, status_code=201)
async def create_plan(body: PlanIn, user: str = Depends(current_user), db: Session = Depends(get_db),
                      provider: MarketProvider = Depends(get_provider), clock: Clock = Depends(get_clock)) -> JSONDict:
    acc = await asyncio.to_thread(db.get, Account, body.account_id)
    if not acc or acc.user_id != user:
        raise HTTPException(404, "account not found")
    price = (await provider.quote(body.symbol))["price"]
    check = await check_for(db, user, provider, body.symbol, body.quantity * price, book_mode_of(acc))
    if check["requires_note"] and len(body.note.strip()) < 20:
        raise HTTPException(422, {"message": "This buy breaks some of your rules. Write why you still want it (20+ characters).", "check": check})

    now = clock()
    if check["verdict"] == "block":
        status, available = "blocked", now
    elif check["verdict"] == "warn" and check["cooling_off_hours"]:
        status, available = "cooling_off", now + timedelta(hours=check["cooling_off_hours"])
    else:
        status, available = "ready", now
    p = BuyPlan(user_id=user, account_id=body.account_id, symbol=body.symbol, quantity=body.quantity, price=price,
                note=body.note.strip(), verdict=check["verdict"], check_json=json.dumps(check), status=status,
                available_at=available)
    db.add(p)
    await asyncio.to_thread(db.commit)
    return _plan_out(p, now)


def _claim(db: Session, p: BuyPlan, observed: str) -> None:
    """Move the plan to `executing` only if nobody else has changed it since we read it.

    A double-click or a retried request would otherwise run two executions concurrently and
    create two holdings for one approved plan.
    """
    result = db.execute(update(BuyPlan).where(BuyPlan.id == p.id, BuyPlan.status == observed).values(status="executing"))
    db.commit()
    if not isinstance(result, CursorResult) or result.rowcount != 1:
        raise HTTPException(409, "plan is already being executed or has changed")


@router.post("/plans/{plan_id}/execute", response_model=PlanOut)
async def execute_plan(
    plan_id: int,
    user: str = Depends(current_user),
    db: Session = Depends(get_db),
    provider: MarketProvider = Depends(get_provider),
    clock: Clock = Depends(get_clock),
) -> JSONDict:
    p = await asyncio.to_thread(_own_plan, db, plan_id, user)
    out = _plan_out(p, clock())
    if out["status"] != "ready":
        raise HTTPException(409, f"plan is {out['status']}" + (f" until {out['available_at']}" if out["status"] == "cooling_off" else ""))
    acc = await asyncio.to_thread(db.get, Account, p.account_id)
    if acc is None:
        raise HTTPException(404, "account not found")
    observed = p.status  # "ready", or "cooling_off" whose wait is over
    await asyncio.to_thread(_claim, db, p, observed)
    try:
        return await _execute_claimed(db, user, p, acc, provider, clock)
    except Exception:  # release the claim unless the attempt already moved the plan to a final state
        await asyncio.to_thread(_release, db, p, observed)
        raise


def _release(db: Session, p: BuyPlan, observed: str) -> None:
    db.rollback()
    db.refresh(p)
    if p.status == "executing":
        p.status = observed
        db.commit()


async def _execute_claimed(db: Session, user: str, p: BuyPlan, acc: Account, provider: MarketProvider, clock: Clock) -> JSONDict:
    # re-check at execution time: prices and the portfolio may have moved during cooling-off
    price = (await provider.quote(p.symbol))["price"]
    recheck = await check_for(db, user, provider, p.symbol, p.quantity * price, book_mode_of(acc))
    if recheck["verdict"] == "block":
        p.status, p.check_json, p.verdict = "blocked", json.dumps(recheck), "block"
        await asyncio.to_thread(db.commit)
        raise HTTPException(409, {"message": "The buy no longer passes your rules.", "check": recheck})
    if recheck["verdict"] == "warn" and p.verdict != "warn":
        await asyncio.to_thread(_send_back_through_warn_flow, db, p, recheck, clock())
    try:
        pay_for_paper_buy(acc, p.quantity * price)
    except InsufficientPaperCashError as e:
        raise HTTPException(409, {"message": str(e), "check": recheck}) from e
    h = Holding(user_id=user, account_id=p.account_id, symbol=p.symbol, quantity=p.quantity, avg_cost=price)
    db.add(h)
    await asyncio.to_thread(db.flush)
    if p.note:
        db.add(StockNote(user_id=user, symbol=p.symbol, kind="thesis", title=f"Why I bought ({p.quantity:g} @ {price:.2f})", body=p.note))
    p.status, p.price, p.executed_holding_id = "executed", price, h.id
    await asyncio.to_thread(db.commit)
    return _plan_out(p, clock())


def _send_back_through_warn_flow(db: Session, p: BuyPlan, recheck: JSONDict, now: datetime) -> None:
    """A plan approved as `pass` now breaks a rule: it gets the same note + cooling-off a warn plan needs.

    Raises:
        HTTPException: 409 always, unless the plan already has a reason and the profile has no
            cooling-off, in which case it may go ahead now (the caller continues).
    """
    p.verdict, p.check_json = "warn", json.dumps(recheck)
    if len(p.note.strip()) < 20:
        p.status = "cancelled"
        db.commit()
        raise HTTPException(409, {"message": "This buy now breaks some of your rules. Make a new plan and write why you still want it.", "check": recheck})
    hours = recheck["cooling_off_hours"]
    if hours:
        p.status, p.available_at = "cooling_off", now + timedelta(hours=hours)
        db.commit()
        raise HTTPException(409, {"message": f"This buy now breaks some of your rules, so it waits {hours}h before it can run.", "check": recheck})


@router.post("/plans/{plan_id}/cancel", response_model=PlanOut)
def cancel_plan(plan_id: int, user: str = Depends(current_user), db: Session = Depends(get_db), now: Clock = Depends(get_clock)) -> JSONDict:
    p = _own_plan(db, plan_id, user)
    if p.status == "executed":
        raise HTTPException(409, "already executed")
    p.status = "cancelled"
    db.commit()
    return _plan_out(p, now())

