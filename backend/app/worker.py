"""Background worker (Render "Background Worker" service).

Every WORKER_INTERVAL_SECONDS: evaluate each user's PAPI targets, risk-rule concentration and
watchlist price alerts, and write deduplicated Alert rows that the UI shows in the bell menu.
Targets and risk rules are checked against real-money accounts only; paper accounts never alert.
Run:  python -m app.worker        (or --once for a single pass)
"""

import asyncio
import logging
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.log_config import configure_logging
from app.market import get_provider
from app.market.base import MarketProvider
from app.models import Alert, RiskProfile, Target, WatchItem
from app.portfolio import portfolio_snapshot, quotes_for
from app.safety.check import portfolio_breaches
from app.safety.service import book_for, rules_for
from app.targets import breach_messages, evaluate, risk_by_symbol

logger = logging.getLogger(__name__)


def _emit(db: Session, user: str, source: str, ref_id: int, symbol: str | None, key: str, msg: str) -> bool:
    # one alert per condition until the user reads it; re-fires after it's marked read
    exists = db.scalar(select(Alert.id).where(Alert.user_id == user, Alert.dedupe_key == key, Alert.read.is_(False)))
    if exists:
        return False
    db.add(Alert(user_id=user, source=source, ref_id=ref_id, symbol=symbol, message=msg, dedupe_key=key))
    return True


def _users_to_check(db: Session) -> tuple[set[str], set[str]]:
    """(users with a risk profile, every user with targets, watch items or a profile)."""
    profiled = set(db.scalars(select(RiskProfile.user_id)).all())
    others = set(db.scalars(select(Target.user_id)).all()) | set(db.scalars(select(WatchItem.user_id)).all())
    return profiled, others | profiled


async def run_once() -> int:
    """One pass over every user; returns the number of new alerts.

    Each user is checked and committed on their own, so one user's bad data or a provider error
    on one of their symbols costs only that user's alerts for this pass, not everyone's.
    """
    provider = get_provider()
    created = failed = 0
    with SessionLocal() as db:
        profiled, users = await asyncio.to_thread(_users_to_check, db)
        for user in sorted(users):
            try:
                n = await _alerts_for_user(db, user, provider, user in profiled)
                await asyncio.to_thread(db.commit)
                created += n
            except Exception:  # isolation boundary: log, drop this user's pass, keep going
                await asyncio.to_thread(db.rollback)
                failed += 1
                logger.exception("worker: alerts failed for one user", extra={"user_id": user})
    if failed:
        logger.warning("worker pass finished with %d failed user(s)", failed)
    return created


async def _alerts_for_user(db: Session, user: str, provider: MarketProvider, profiled: bool) -> int:
    created = 0
    if profiled:
        created += await _risk_rule_alerts(db, user, provider)
    targets = await asyncio.to_thread(lambda: db.scalars(select(Target).where(Target.user_id == user)).all())
    if targets:
        snap = await portfolio_snapshot(db, user, provider, "real")
        risks = await risk_by_symbol(provider, {h["symbol"] for h in snap["holdings"]})
        for t in targets:
            for key, msg in breach_messages(evaluate(t, snap, risks)):
                created += await asyncio.to_thread(_emit, db, user, "target", t.id, t.symbol, key, msg)

    watch = await asyncio.to_thread(lambda: db.scalars(
        select(WatchItem).where(
            WatchItem.user_id == user, (WatchItem.alert_above.isnot(None)) | (WatchItem.alert_below.isnot(None))
        )
    ).all())
    quotes = await quotes_for(provider, {w.symbol for w in watch})
    for w in watch:
        q = quotes.get(w.symbol)
        if not q:
            continue
        if w.alert_above is not None and q["price"] >= w.alert_above:
            created += await asyncio.to_thread(_emit, db, user, "watch", w.id, w.symbol, f"watch:{w.id}:above", f"{w.symbol} at {q['price']} ≥ {w.alert_above}")
        if w.alert_below is not None and q["price"] <= w.alert_below:
            created += await asyncio.to_thread(_emit, db, user, "watch", w.id, w.symbol, f"watch:{w.id}:below", f"{w.symbol} at {q['price']} ≤ {w.alert_below}")
    return created


async def _risk_rule_alerts(db: Session, user: str, provider: MarketProvider) -> int:
    """Position and sector concentration of the real-money book against the user's risk profile."""
    _, book, _ = await book_for(db, user, provider, "real")
    breaches = portfolio_breaches(await asyncio.to_thread(rules_for, db, user), book)
    return sum([
        await asyncio.to_thread(_emit, db, user, "risk", 0, b.subject if b.rule == "position_size" else None,
                                f"risk:{b.rule.replace('_size', '')}:{b.subject}", b.message)
        for b in breaches
    ])


async def main(once: bool) -> None:
    interval = get_settings().worker_interval_seconds
    while True:
        try:
            n = await run_once()
            logger.info("worker pass done, %d new alerts", n)
        except Exception:
            logger.exception("worker pass failed")
        if once:
            return
        await asyncio.sleep(interval)


if __name__ == "__main__":
    configure_logging(get_settings().log_level, get_settings().log_format)
    asyncio.run(main(once="--once" in sys.argv))
