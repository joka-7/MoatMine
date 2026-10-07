import asyncio
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.market import get_provider
from app.models import Account, Holding
from app.errors import InsufficientPaperCashError
from app.portfolio import BookMode, book_mode_of, holdings_in_book, is_paper, pay_for_paper_buy, portfolio_snapshot
from app.safety.service import check_for
from app.schemas import AccountIn, AccountOut, HoldingIn, HoldingUpdate

router = APIRouter(tags=["portfolio"])


def _own(db: Session, model, obj_id: int, user: str):
    obj = db.get(model, obj_id)
    if not obj or obj.user_id != user:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(user: str = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Account).where(Account.user_id == user)).all()


@router.post("/accounts", response_model=AccountOut, status_code=201)
def create_account(body: AccountIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    acc = Account(user_id=user, **body.model_dump())
    db.add(acc)
    db.commit()
    return acc


@router.put("/accounts/{account_id}", response_model=AccountOut)
def update_account(account_id: int, body: AccountIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    acc = _own(db, Account, account_id, user)
    for k, v in body.model_dump().items():
        setattr(acc, k, v)
    db.commit()
    return acc


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, Account, account_id, user))
    db.commit()


@router.post("/holdings", status_code=201)
async def add_holding(body: HoldingIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    """Record a position. Always runs the safety check against the user's risk rules.

    Paper accounts enforce it (a blocked buy is refused) and pay for the buy from their cash;
    real accounts record what was actually bought and return the check as a warning, since
    refusing wouldn't undo the trade.
    """
    acc = _own(db, Account, body.account_id, user)
    check = await check_for(db, user, get_provider(), body.symbol, body.quantity * body.avg_cost, book_mode_of(acc))
    if is_paper(acc) and check["verdict"] == "block":
        raise HTTPException(409, {"message": "Blocked by your risk rules. Use a buy plan or change your profile.", "check": check})
    try:
        pay_for_paper_buy(acc, body.quantity * body.avg_cost)
    except InsufficientPaperCashError as e:
        raise HTTPException(409, {"message": str(e), "check": check}) from e
    h = Holding(user_id=user, **body.model_dump(exclude_none=True))
    db.add(h)
    db.commit()
    return {"id": h.id, "check": check}


@router.patch("/holdings/{holding_id}")
def update_holding(holding_id: int, body: HoldingUpdate, user: str = Depends(current_user), db: Session = Depends(get_db)):
    h = _own(db, Holding, holding_id, user)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(h, k, v)
    db.commit()
    return {"id": h.id}


@router.delete("/holdings/{holding_id}", status_code=204)
def delete_holding(holding_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, Holding, holding_id, user))
    db.commit()


@router.get("/portfolio")
async def get_portfolio(mode: BookMode = "real", user: str = Depends(current_user), db: Session = Depends(get_db)):
    return await portfolio_snapshot(db, user, get_provider(), mode)


@router.get("/portfolio/history")
async def portfolio_history(
    days: int = Query(180, ge=7, le=3650),
    mode: BookMode = "real",
    user: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Daily market value of one book's current holdings (quantities held constant) — for the value-over-time chart."""
    holdings = holdings_in_book(db, user, mode)
    if not holdings:
        return []
    end = int(time.time())
    start = end - days * 86400
    provider = get_provider()
    syms = sorted({h.symbol for h in holdings})
    series = await asyncio.gather(*(provider.candles(s, "D", start, end) for s in syms))
    qty: dict[str, float] = {}
    for h in holdings:
        qty[h.symbol] = qty.get(h.symbol, 0) + h.quantity

    by_day: dict[int, float] = {}
    for sym, bars in zip(syms, series):
        for b in bars:
            day = b["t"] - b["t"] % 86400
            by_day[day] = by_day.get(day, 0) + b["c"] * qty[sym]
    return [{"t": t, "value": round(v, 2)} for t, v in sorted(by_day.items())]
