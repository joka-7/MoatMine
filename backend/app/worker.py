"""Background worker (Render "Background Worker" service).

Every WORKER_INTERVAL_SECONDS: evaluate each user's PAPI targets, risk-rule concentration and
watchlist price alerts, and write deduplicated Alert rows that the UI shows in the bell menu.
Targets and risk rules are checked against real-money accounts only; paper accounts never alert.
Run:  python -m app.worker        (or --once for a single pass)
"""

import asyncio
import contextlib
import logging
import signal
import sys
import time
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.clock import utc_now
from app.config import get_settings
from app.db import SessionLocal
from app.errors import MarketDataError
from app.log_config import configure_logging
from app.market import describe_error, get_provider
from app.market.base import MarketProvider
from app.market.sources import is_sample_data, source_label, track_sources
from app.models import ALERT_WORKER, Alert, RiskProfile, Target, WatchItem, WorkerHeartbeat
from app.portfolio import cached_daily_candles, held_value_history, holdings_in_book, portfolio_snapshot, quotes_for
from app.safety.check import Breach, Rules, loss_limit_breach, portfolio_breaches
from app.safety.service import book_for, rules_for
from app.targets import breach_messages, evaluate, risk_by_symbol

logger = logging.getLogger(__name__)


def _emit(db: Session, user: str, source: str, ref_id: int, symbol: str | None, key: str, msg: str) -> bool:
    # one alert per condition until the user reads it; re-fires after it's marked read
    exists = db.scalar(select(Alert.id).where(Alert.user_id == user, Alert.dedupe_key == key, Alert.read.is_(False)))
    if exists:
        return False
    try:
        with db.begin_nested():  # the unique index catches a pass running alongside this one
            db.add(Alert(user_id=user, source=source, ref_id=ref_id, symbol=symbol, message=msg, dedupe_key=key))
    except IntegrityError:
        return False
    return True


def _users_to_check(db: Session) -> tuple[set[str], set[str]]:
    """(users with a risk profile, every user with targets, watch items or a profile)."""
    profiled = set(db.scalars(select(RiskProfile.user_id)).all())
    others = set(db.scalars(select(Target.user_id)).all()) | set(db.scalars(select(WatchItem.user_id)).all())
    return profiled, others | profiled


def _record_heartbeat(db: Session, started: float, created: int, failed: int) -> None:
    beat = db.get(WorkerHeartbeat, ALERT_WORKER) or WorkerHeartbeat(name=ALERT_WORKER)
    beat.finished_at = datetime.now(UTC)
    beat.duration_seconds = round(time.monotonic() - started, 3)
    beat.alerts_created, beat.users_failed = created, failed
    db.add(beat)
    db.commit()


async def run_once(stop: asyncio.Event | None = None) -> int:
    """One pass over every user; returns the number of new alerts.

    Each user is checked and committed on their own, so one user's bad data or a provider error
    on one of their symbols costs only that user's alerts for this pass, not everyone's.
    A set `stop` event ends the pass after the current user; a finished pass records a heartbeat.
    """
    provider = get_provider()
    created = failed = 0
    started = time.monotonic()
    with SessionLocal() as db:
        profiled, users = await asyncio.to_thread(_users_to_check, db)
        for i, user in enumerate(sorted(users)):
            if stop is not None and stop.is_set():
                logger.info("worker stopping mid-pass", extra={"users_left": len(users) - i})
                return created
            try:
                n = await _alerts_for_user(db, user, provider, user in profiled)
                await asyncio.to_thread(db.commit)
                created += n
            except Exception:  # isolation boundary: log, drop this user's pass, keep going
                await asyncio.to_thread(db.rollback)
                failed += 1
                logger.exception("worker: alerts failed for one user", extra={"user_id": user})
        await asyncio.to_thread(_record_heartbeat, db, started, created, failed)
    if failed:
        logger.warning(f"worker pass finished with {failed} failed user(s)")
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
            for key, msg in breach_messages(evaluate(t, snap, risks, utc_now())):
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


async def _loss_limit_breach(db: Session, user: str, provider: MarketProvider, rules: Rules) -> Breach | None:
    """The real-money holdings' fall from their 1-year high, against the loss limit.

    Skipped when the history is sample data (the mock provider, or Finnhub's fallback to it): an
    alert about a fall that didn't happen is worse than none. Also skipped, with a warning, when
    the prices can't be fetched, so the user's other alerts for this pass still go out.
    """
    holdings = await asyncio.to_thread(holdings_in_book, db, user, "real")
    if not holdings:
        return None
    today = int(time.time()) // 86400 * 86400  # day-aligned so the cached bars are reused all day
    try:
        with track_sources() as used:
            history = await held_value_history(provider, holdings, 365, today, cached_daily_candles)
    except (httpx.HTTPError, MarketDataError) as e:
        logger.warning("loss-limit check skipped: price history unavailable", extra={"user_id": user, **describe_error(e)})
        return None
    if is_sample_data(source_label(provider.name, used)):
        return None
    return loss_limit_breach(rules, [p["value"] for p in history])


async def _risk_rule_alerts(db: Session, user: str, provider: MarketProvider) -> int:
    """Concentration and loss limit of the real-money book against the user's risk profile."""
    _, book, _ = await book_for(db, user, provider, "real")
    rules = await asyncio.to_thread(rules_for, db, user)
    breaches = portfolio_breaches(rules, book)
    if (fall := await _loss_limit_breach(db, user, provider, rules)) is not None:
        breaches.append(fall)
    return sum([
        await asyncio.to_thread(_emit, db, user, "risk", 0, b.subject if b.rule == "position_size" else None,
                                f"risk:{b.rule.replace('_size', '')}:{b.subject}", b.message)
        for b in breaches
    ])


async def main(once: bool) -> None:
    """Run passes every WORKER_INTERVAL_SECONDS until SIGTERM/SIGINT (Render sends SIGTERM on deploy)."""
    interval = get_settings().worker_interval_seconds
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    while not stop.is_set():
        try:
            n = await run_once(stop)
            logger.info(f"worker pass done, {n} new alerts")
        except Exception:
            logger.exception("worker pass failed")
        if once:
            return
        with contextlib.suppress(TimeoutError):  # woken early by a signal, or the interval passed
            await asyncio.wait_for(stop.wait(), interval)
    logger.info("worker stopped")


if __name__ == "__main__":
    configure_logging(get_settings().log_level, get_settings().log_format)
    asyncio.run(main(once="--once" in sys.argv))
