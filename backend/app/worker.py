"""Background worker (Render "Background Worker" service).

Every WORKER_INTERVAL_SECONDS: evaluate each user's PAPI targets and watchlist price alerts,
and write deduplicated Alert rows that the UI shows in the bell menu.
Run:  python -m app.worker        (or --once for a single pass)
"""

import asyncio
import logging
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.market import get_provider
from app.models import Alert, Target, WatchItem
from app.portfolio import portfolio_snapshot, quotes_for
from app.targets import breach_messages, evaluate, risk_by_symbol

log = logging.getLogger("folio.worker")


def _emit(db: Session, user: str, source: str, ref_id: int, symbol: str | None, key: str, msg: str) -> bool:
    # one alert per condition until the user reads it; re-fires after it's marked read
    exists = db.scalar(select(Alert.id).where(Alert.user_id == user, Alert.dedupe_key == key, Alert.read.is_(False)))
    if exists:
        return False
    db.add(Alert(user_id=user, source=source, ref_id=ref_id, symbol=symbol, message=msg, dedupe_key=key))
    return True


async def run_once() -> int:
    provider = get_provider()
    created = 0
    with SessionLocal() as db:
        users = set(db.scalars(select(Target.user_id)).all()) | set(db.scalars(select(WatchItem.user_id)).all())
        for user in users:
            targets = db.scalars(select(Target).where(Target.user_id == user)).all()
            if targets:
                snap = await portfolio_snapshot(db, user, provider)
                risks = await risk_by_symbol(provider, {h["symbol"] for h in snap["holdings"]})
                for t in targets:
                    for key, msg in breach_messages(evaluate(t, snap, risks)):
                        created += _emit(db, user, "target", t.id, t.symbol, key, msg)

            watch = db.scalars(
                select(WatchItem).where(
                    WatchItem.user_id == user, (WatchItem.alert_above.isnot(None)) | (WatchItem.alert_below.isnot(None))
                )
            ).all()
            quotes = await quotes_for(provider, {w.symbol for w in watch})
            for w in watch:
                q = quotes.get(w.symbol)
                if not q:
                    continue
                if w.alert_above is not None and q["price"] >= w.alert_above:
                    created += _emit(db, user, "watch", w.id, w.symbol, f"watch:{w.id}:above", f"{w.symbol} at {q['price']} ≥ {w.alert_above}")
                if w.alert_below is not None and q["price"] <= w.alert_below:
                    created += _emit(db, user, "watch", w.id, w.symbol, f"watch:{w.id}:below", f"{w.symbol} at {q['price']} ≤ {w.alert_below}")
        db.commit()
    return created


async def main(once: bool) -> None:
    init_db()
    interval = get_settings().worker_interval_seconds
    while True:
        try:
            n = await run_once()
            log.info("worker pass done, %d new alerts", n)
        except Exception:
            log.exception("worker pass failed")
        if once:
            return
        await asyncio.sleep(interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main(once="--once" in sys.argv))
