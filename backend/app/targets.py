"""PAPI (Profit, Amount, Period, Intent) evaluation against MAMI (min/max) bounds."""

import time
from datetime import datetime, timezone

from app.analytics import annual_volatility_pct
from app.market.base import MarketProvider
from app.models import Target

INTENTS = ["growth", "income", "speculation", "hedge", "retirement", "custom"]


def check_bound(value: float | None, target: float | None, lo: float | None, hi: float | None) -> dict:
    if value is None:
        status = "no_data"
    elif lo is not None and value < lo:
        status = "below_min"
    elif hi is not None and value > hi:
        status = "above_max"
    elif target is None and lo is None and hi is None:
        status = "unset"
    elif target is not None and value >= target:
        status = "reached"
    else:
        status = "ok"
    progress = round(value / target * 100, 1) if value is not None and target else None
    return {"value": value, "target": target, "min": lo, "max": hi, "status": status, "progress_pct": progress}


async def risk_by_symbol(provider: MarketProvider, symbols: set[str], lookback_days: int = 365) -> dict[str, float | None]:
    end = int(time.time())
    out: dict[str, float | None] = {}
    for s in symbols:
        try:
            bars = await provider.candles(s, "D", end - lookback_days * 86400, end)
            out[s] = annual_volatility_pct([b["c"] for b in bars])
        except Exception:
            out[s] = None
    return out


def _days_since(iso_dates: list[str]) -> int | None:
    if not iso_dates:
        return None
    first = min(datetime.fromisoformat(d) for d in iso_dates)
    if first.tzinfo is None:
        first = first.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - first).days


def evaluate(t: Target, snapshot: dict, risks: dict[str, float | None]) -> dict:
    holdings = snapshot["holdings"]
    if t.symbol:
        rows = [h for h in holdings if h["symbol"] == t.symbol]
        cost = sum(h["cost"] for h in rows)
        value = sum(h["value"] for h in rows)
        profit = round((value / cost - 1) * 100, 2) if cost else None
        amount = round(value, 2) if rows else None
        risk = risks.get(t.symbol)
    else:
        rows = holdings
        tot = snapshot["totals"]
        profit = tot["pnl_pct"] if tot["cost"] else None
        amount = tot["net_worth"]
        weighted = [(h["value"], risks.get(h["symbol"])) for h in rows if risks.get(h["symbol"]) is not None]
        wsum = sum(v for v, _ in weighted)
        risk = round(sum(v * r for v, r in weighted) / wsum, 2) if wsum else None

    period = _days_since([h["opened_at"] for h in rows])

    checks = {
        "profit": check_bound(profit, t.profit_target, t.profit_min, t.profit_max),
        "amount": check_bound(amount, t.amount_target, t.amount_min, t.amount_max),
        "period": check_bound(period, t.period_target_days, t.period_min_days, t.period_max_days),
        "intent": {**check_bound(risk, t.risk_target, t.risk_min, t.risk_max), "intent": t.intent, "note": t.intent_note},
    }
    breaches = [k for k, c in checks.items() if c["status"] in ("below_min", "above_max")]
    return {"target_id": t.id, "name": t.name, "symbol": t.symbol, "checks": checks, "breaches": breaches}


def breach_messages(result: dict) -> list[tuple[str, str]]:
    """(dedupe_key, message) for each breached dimension."""
    scope = result["symbol"] or "portfolio"
    out = []
    for dim in result["breaches"]:
        c = result["checks"][dim]
        side = "below min" if c["status"] == "below_min" else "above max"
        bound = c["min"] if c["status"] == "below_min" else c["max"]
        key = f"target:{result['target_id']}:{dim}:{c['status']}"
        out.append((key, f"[{result['name']}] {scope} {dim} {c['value']} is {side} ({bound})"))
    return out
