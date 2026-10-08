import asyncio
import time
from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.errors import InsufficientPaperCashError
from app.jsontypes import JSONDict
from app.market import get_provider
from app.market.base import MarketProvider
from app.models import Account, Holding
from app.portfolio import (
    PAPER_BROKER,
    BookMode,
    book_mode_of,
    holdings_in_book,
    is_paper,
    pay_for_paper_buy,
    portfolio_snapshot,
)
from app.safety.service import check_for
from app.schemas import AccountIn, AccountOut, HoldingIn, HoldingUpdate

router = APIRouter(tags=["portfolio"])


def _own[Owned: (Account, Holding)](db: Session, model: type[Owned], obj_id: int, user: str) -> Owned:
    obj = db.get(model, obj_id)
    if not obj or obj.user_id != user:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(user: str = Depends(current_user), db: Session = Depends(get_db)) -> Sequence[Account]:
    return db.scalars(select(Account).where(Account.user_id == user)).all()


@router.post("/accounts", response_model=AccountOut, status_code=201)
def create_account(body: AccountIn, user: str = Depends(current_user), db: Session = Depends(get_db)) -> Account:
    acc = Account(user_id=user, **body.model_dump())
    db.add(acc)
    db.commit()
    return acc


@router.put("/accounts/{account_id}", response_model=AccountOut)
def update_account(account_id: int, body: AccountIn, user: str = Depends(current_user), db: Session = Depends(get_db)) -> Account:
    acc = _own(db, Account, account_id, user)
    if (body.broker == PAPER_BROKER) != is_paper(acc):
        # moving an account would carry its positions and cash into the other book
        raise HTTPException(409, "An account can't switch between real money and paper. Create a new account instead.")
    for k, v in body.model_dump().items():
        setattr(acc, k, v)
    db.commit()
    return acc


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)) -> None:
    db.delete(_own(db, Account, account_id, user))
    db.commit()


@router.post("/holdings", status_code=201)
async def add_holding(body: HoldingIn, user: str = Depends(current_user), db: Session = Depends(get_db), provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    """Record a position. Always runs the safety check against the user's risk rules.

    Real accounts record what was actually bought (at the cost the user enters) and return the
    check as a warning, since refusing wouldn't undo the trade. Paper accounts are a simulated
    buy now: priced at the live quote whatever avg_cost says, refused if the rules block it,
    and paid for from the account's cash.
    """
    acc = await asyncio.to_thread(_own, db, Account, body.account_id, user)
    fields = body.model_dump(exclude_none=True)
    if is_paper(acc):
        fields["avg_cost"] = (await provider.quote(body.symbol))["price"]
    cost = body.quantity * fields["avg_cost"]
    check = await check_for(db, user, provider, body.symbol, cost, book_mode_of(acc))
    if is_paper(acc) and check["verdict"] == "block":
        raise HTTPException(409, {"message": "Blocked by your risk rules. Use a buy plan or change your profile.", "check": check})
    try:
        pay_for_paper_buy(acc, cost)
    except InsufficientPaperCashError as e:
        raise HTTPException(409, {"message": str(e), "check": check}) from e
    h = Holding(user_id=user, **fields)
    db.add(h)
    await asyncio.to_thread(db.commit)
    return {"id": h.id, "check": check}


@router.patch("/holdings/{holding_id}")
def update_holding(holding_id: int, body: HoldingUpdate, user: str = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, int]:
    h = _own(db, Holding, holding_id, user)
    changes = body.model_dump(exclude_none=True)
    if is_paper(h.account) and ({"quantity", "avg_cost"} & changes.keys()):
        # resizing would skip the safety check and the cash; paper positions change through buys and sells
        raise HTTPException(409, "Paper positions change only by buying or removing (selling) them.")
    for k, v in changes.items():
        setattr(h, k, v)
    db.commit()
    return {"id": h.id}


@router.delete("/holdings/{holding_id}", status_code=204)
async def delete_holding(holding_id: int, user: str = Depends(current_user), db: Session = Depends(get_db), provider: MarketProvider = Depends(get_provider)) -> None:
    """Remove a position. For paper, that is a sale at the live quote: the proceeds go back to its cash."""
    h = await asyncio.to_thread(_own, db, Holding, holding_id, user)
    acc = await asyncio.to_thread(lambda: h.account)  # lazy relationship load is a query too
    if is_paper(acc):
        price = (await provider.quote(h.symbol))["price"]
        acc.cash = round(acc.cash + h.quantity * price, 2)
    await asyncio.to_thread(db.delete, h)
    await asyncio.to_thread(db.commit)


@router.get("/portfolio")
async def get_portfolio(mode: BookMode = "real", user: str = Depends(current_user), db: Session = Depends(get_db), provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    return await portfolio_snapshot(db, user, provider, mode)


@router.get("/portfolio/history")
async def portfolio_history(
    days: int = Query(180, ge=7, le=3650),
    mode: BookMode = "real",
    user: str = Depends(current_user),
    db: Session = Depends(get_db),
    provider: MarketProvider = Depends(get_provider),
) -> list[JSONDict]:
    """Daily market value of one book's current holdings (quantities held constant) — for the value-over-time chart."""
    holdings = await asyncio.to_thread(holdings_in_book, db, user, mode)
    if not holdings:
        return []
    end = int(time.time())
    start = end - days * 86400
    syms = sorted({h.symbol for h in holdings})
    series = await asyncio.gather(*(provider.candles(s, "D", start, end) for s in syms))
    qty: dict[str, float] = {}
    for h in holdings:
        qty[h.symbol] = qty.get(h.symbol, 0) + h.quantity

    by_day: dict[int, float] = {}
    for sym, bars in zip(syms, series, strict=True):
        for b in bars:
            day = b["t"] - b["t"] % 86400
            by_day[day] = by_day.get(day, 0) + b["c"] * qty[sym]
    return [{"t": t, "value": round(v, 2)} for t, v in sorted(by_day.items())]
