"""Portfolio valuation shared by the API, the AI tools, the MCP server and the worker."""

import asyncio

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.market.base import MarketProvider
from app.models import Account, Holding


async def quotes_for(provider: MarketProvider, symbols: set[str]) -> dict[str, dict]:
    syms = sorted(symbols)
    results = await asyncio.gather(*(provider.quote(s) for s in syms), return_exceptions=True)
    return {s: q for s, q in zip(syms, results) if not isinstance(q, Exception)}


async def portfolio_snapshot(db: Session, user_id: str, provider: MarketProvider) -> dict:
    accounts = db.scalars(select(Account).where(Account.user_id == user_id)).all()
    holdings = db.scalars(select(Holding).where(Holding.user_id == user_id)).all()
    quotes = await quotes_for(provider, {h.symbol for h in holdings})

    rows = []
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
        },
    }
