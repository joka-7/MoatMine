"""Portfolio valuation shared by the API, the AI tools, the MCP server and the worker.

Paper (practice) accounts and real accounts are two separate books: every total, risk number,
stress test, alert and position-size check is computed for one book only, so practice money
never makes the real portfolio look bigger or more diversified than it is.
"""

import asyncio
import logging
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import InsufficientPaperCashError
from app.jsontypes import JSONDict
from app.market import describe_error
from app.market.base import MarketProvider, Quote
from app.models import Account, Holding

logger = logging.getLogger(__name__)

BookMode = Literal["real", "paper"]
PAPER_BROKER = "paper"


def is_paper(account: Account) -> bool:
    return account.broker == PAPER_BROKER


def book_mode_of(account: Account) -> BookMode:
    return "paper" if is_paper(account) else "real"


def pay_for_paper_buy(account: Account, cost: float) -> None:
    """Take a paper buy's cost out of the paper account's cash.

    Real accounts are left alone: they record trades that already happened at the broker, and the
    user keeps their cash figure in step with the broker statement.

    Raises:
        InsufficientPaperCashError: the paper account can't cover the cost.
    """
    if not is_paper(account):
        return
    if cost > account.cash + 1e-9:
        raise InsufficientPaperCashError(f"{account.name} has {account.cash:,.2f} paper cash; this buy costs {cost:,.2f}")
    account.cash = round(account.cash - cost, 2)


def accounts_in_book(db: Session, user_id: str, mode: BookMode) -> list[Account]:
    paper = Account.broker == PAPER_BROKER
    q = select(Account).where(Account.user_id == user_id, paper if mode == "paper" else ~paper)
    return list(db.scalars(q.order_by(Account.id)).all())


def holdings_in_book(db: Session, user_id: str, mode: BookMode) -> list[Holding]:
    ids = [a.id for a in accounts_in_book(db, user_id, mode)]
    return list(db.scalars(select(Holding).where(Holding.user_id == user_id, Holding.account_id.in_(ids))).all())


async def quotes_for(provider: MarketProvider, symbols: set[str]) -> dict[str, Quote]:
    syms = sorted(symbols)
    results = await asyncio.gather(*(provider.quote(s) for s in syms), return_exceptions=True)
    for s, q in zip(syms, results, strict=True):
        if isinstance(q, BaseException):  # the holding is then marked stale and priced at cost
            logger.warning("quote failed", extra={"symbol": s, **describe_error(q)})
    return {s: q for s, q in zip(syms, results, strict=True) if not isinstance(q, BaseException)}


async def portfolio_snapshot(db: Session, user_id: str, provider: MarketProvider, mode: BookMode = "real") -> JSONDict:
    """Accounts, priced holdings and totals for one book (real money by default, or paper)."""
    accounts = accounts_in_book(db, user_id, mode)
    holdings = holdings_in_book(db, user_id, mode)
    quotes = await quotes_for(provider, {h.symbol for h in holdings})

    rows: list[JSONDict] = []
    total_cost = total_value = day_change = 0.0
    for h in holdings:
        q = quotes.get(h.symbol)
        price = q["price"] if q else h.avg_cost
        cost = h.quantity * h.avg_cost
        value = h.quantity * price
        total_cost += cost
        total_value += value
        if q:
            day_change += h.quantity * q["change"]
        rows.append(
            {
                "id": h.id,
                "account_id": h.account_id,
                "symbol": h.symbol,
                "quantity": h.quantity,
                "avg_cost": h.avg_cost,
                "price": price,
                "value": round(value, 2),
                "cost": round(cost, 2),
                "pnl": round(value - cost, 2),
                "pnl_pct": round((value / cost - 1) * 100, 2) if cost else 0.0,
                "day_change_pct": q["change_pct"] if q else 0.0,
                "opened_at": h.opened_at.isoformat(),
                "stale": q is None,
            }
        )

    cash = sum(a.cash for a in accounts)
    for r in rows:
        r["weight_pct"] = round(r["value"] / total_value * 100, 2) if total_value else 0.0

    return {
        "mode": mode,
        "accounts": [
            {"id": a.id, "name": a.name, "broker": a.broker, "currency": a.currency, "cash": a.cash} for a in accounts
        ],
        "holdings": sorted(rows, key=lambda r: -r["value"]),
        "totals": {
            "cash": round(cash, 2),
            "invested_value": round(total_value, 2),
            "net_worth": round(total_value + cash, 2),
            "cost": round(total_cost, 2),
            "pnl": round(total_value - total_cost, 2),
            "pnl_pct": round((total_value / total_cost - 1) * 100, 2) if total_cost else 0.0,
            "day_change": round(day_change, 2),
            # holdings without a live quote, valued at what was paid: totals and P/L are incomplete
            "unpriced": sorted({r["symbol"] for r in rows if r["stale"]}),
        },
    }
