import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.market import get_provider
from app.models import Account, BuyPlan, Holding, StockNote
from app.safety.profile import LEVELS, QUESTIONS, level_from_answers
from app.safety.service import (
    ai_analysis, check_for, get_profile, portfolio_risk_report, profile_dict, save_profile, stock_safety, stress_report,
)

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
    def _level_source(self):
        if self.level is not None and self.level not in LEVELS:
            raise ValueError(f"level must be one of {LEVELS}")
        if self.answers is None and self.level is None:
            raise ValueError("send questionnaire answers or a level")
        return self


@router.get("/safety/questions")
def questions():
    return {"questions": QUESTIONS, "levels": LEVELS}


@router.get("/safety/profile")
def read_profile(user: str = Depends(current_user), db: Session = Depends(get_db)):
    return profile_dict(get_profile(db, user))


@router.put("/safety/profile")
def write_profile(body: ProfileIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    try:
        level = level_from_answers(body.answers) if body.answers is not None else body.level
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    overrides = body.model_dump(exclude={"answers", "level", "paper_mode"})
    p = save_profile(db, user, level, body.answers or {}, overrides, body.paper_mode)
    return profile_dict(p)


# ---------------- stock safety & checks ----------------


@router.get("/stocks/{symbol}/safety")
async def safety(symbol: str):
    return await stock_safety(get_provider(), _sym(symbol))


@router.post("/stocks/{symbol}/safety/analyze")
async def safety_analyze(symbol: str, user: str = Depends(current_user), db: Session = Depends(get_db)):
    """AI analyzer: explains each area grade and how the stock fits the user's risk rules."""
    from app.ai.dispatcher import DispatchError

    try:
        return await ai_analysis(db, user, get_provider(), _sym(symbol))
    except DispatchError as e:
        raise HTTPException(502, str(e)) from e


class CheckIn(BaseModel):
    symbol: str
    amount: float | None = Field(None, gt=0)
    quantity: float | None = Field(None, gt=0)

    @field_validator("symbol")
    @classmethod
    def _u(cls, v: str) -> str:
        return _sym(v)

    @model_validator(mode="after")
    def _one(self):
        if (self.amount is None) == (self.quantity is None):
            raise ValueError("send exactly one of amount or quantity")
        return self


async def _amount(body: CheckIn) -> tuple[float, float]:
    price = (await get_provider().quote(body.symbol))["price"]
    amount = body.amount if body.amount is not None else body.quantity * price
    return amount, price


@router.post("/safety/check")
async def safety_check(body: CheckIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    amount, price = await _amount(body)
    out = await check_for(db, user, get_provider(), body.symbol, amount)
    out["price"] = price
    return out


@router.get("/safety/portfolio")
async def portfolio_risk(user: str = Depends(current_user), db: Session = Depends(get_db)):
    return await portfolio_risk_report(db, user, get_provider())


@router.get("/safety/stress")
async def stress(user: str = Depends(current_user), db: Session = Depends(get_db)):
    return await stress_report(db, user, get_provider())


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


def _plan_out(p: BuyPlan) -> dict:
    now = datetime.now(timezone.utc)
    avail = p.available_at if p.available_at.tzinfo else p.available_at.replace(tzinfo=timezone.utc)
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


@router.get("/plans")
def list_plans(user: str = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(BuyPlan).where(BuyPlan.user_id == user).order_by(BuyPlan.created_at.desc()).limit(100)).all()
    return [_plan_out(p) for p in rows]


@router.post("/plans", status_code=201)
async def create_plan(body: PlanIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    acc = db.get(Account, body.account_id)
    if not acc or acc.user_id != user:
        raise HTTPException(404, "account not found")
    price = (await get_provider().quote(body.symbol))["price"]
    check = await check_for(db, user, get_provider(), body.symbol, body.quantity * price)
    if check["requires_note"] and len(body.note.strip()) < 20:
        raise HTTPException(422, {"message": "This buy breaks some of your rules. Write why you still want it (20+ characters).", "check": check})

    now = datetime.now(timezone.utc)
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
    db.commit()
    return _plan_out(p)


@router.post("/plans/{plan_id}/execute")
async def execute_plan(plan_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    p = _own_plan(db, plan_id, user)
    out = _plan_out(p)
    if out["status"] != "ready":
        raise HTTPException(409, f"plan is {out['status']}" + (f" until {out['available_at']}" if out["status"] == "cooling_off" else ""))
    # re-check at execution time: prices and the portfolio may have moved during cooling-off
    price = (await get_provider().quote(p.symbol))["price"]
    recheck = await check_for(db, user, get_provider(), p.symbol, p.quantity * price)
    if recheck["verdict"] == "block":
        p.status, p.check_json, p.verdict = "blocked", json.dumps(recheck), "block"
        db.commit()
        raise HTTPException(409, {"message": "The buy no longer passes your rules.", "check": recheck})
    h = Holding(user_id=user, account_id=p.account_id, symbol=p.symbol, quantity=p.quantity, avg_cost=price)
    db.add(h)
    db.flush()
    if p.note:
        db.add(StockNote(user_id=user, symbol=p.symbol, kind="thesis", title=f"Why I bought ({p.quantity:g} @ {price:.2f})", body=p.note))
    p.status, p.price, p.executed_holding_id = "executed", price, h.id
    db.commit()
    return _plan_out(p)


@router.post("/plans/{plan_id}/cancel")
def cancel_plan(plan_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    p = _own_plan(db, plan_id, user)
    if p.status == "executed":
        raise HTTPException(409, "already executed")
    p.status = "cancelled"
    db.commit()
    return _plan_out(p)

