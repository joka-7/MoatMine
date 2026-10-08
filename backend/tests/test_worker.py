import asyncio
import os
import signal
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app import worker
from app.db import SessionLocal
from app.market import get_provider
from app.models import ALERT_WORKER, Alert, WorkerHeartbeat
from app.safety.service import book_for
from tests.conftest import auth

GOOD, BAD = "worker-good", "worker-bad"


class _FailsFor:
    """Market provider that raises for one symbol and delegates everything else."""

    name = "fails-for-test"

    def __init__(self, inner, symbol: str):
        self._inner, self._symbol = inner, symbol

    def __getattr__(self, item):
        method = getattr(self._inner, item)

        async def call(symbol, *args, **kwargs):
            if symbol == self._symbol:
                raise RuntimeError(f"provider down for {symbol}")
            return await method(symbol, *args, **kwargs)

        return call


def test_run_once_isolates_a_failing_user(client, monkeypatch):
    for user in (GOOD, BAD):
        client.post("/watchlist", json={"symbol": "AAPL", "alert_below": 1_000_000}, headers=auth(user))
    real = worker._alerts_for_user

    async def flaky(db, user, provider, profiled):
        if user == BAD:
            raise RuntimeError("bad data for this user")
        return await real(db, user, provider, profiled)

    monkeypatch.setattr(worker, "_alerts_for_user", flaky)
    asyncio.run(worker.run_once())  # must not raise
    good = client.get("/alerts?unread_only=true", headers=auth(GOOD)).json()
    assert any("AAPL" in a["message"] for a in good)
    assert client.get("/alerts?unread_only=true", headers=auth(BAD)).json() == []


def test_book_for_counts_a_failed_sector_lookup_as_unknown(client):
    who = auth("sector-flaky")
    acc = client.post("/accounts", json={"name": "B", "cash": 0}, headers=who).json()["id"]
    for sym in ("AAPL", "MSFT"):
        client.post("/holdings", json={"account_id": acc, "symbol": sym, "quantity": 1, "avg_cost": 1}, headers=who)
    with SessionLocal() as db:
        _, book, sectors = asyncio.run(book_for(db, "sector-flaky", _FailsFor(get_provider(), "MSFT"), "real"))
    assert sectors["MSFT"] is None and sectors["AAPL"]
    assert "Unknown" in book.by_sector and set(book.by_symbol) == {"AAPL", "MSFT"}


class _FallsBy:
    """Market provider whose daily bars fall from 100 to `last` over the window; the rest delegates."""

    name = "falls-for-test"

    def __init__(self, inner, last: float):
        self._inner, self._last = inner, last

    def __getattr__(self, item):
        return getattr(self._inner, item)

    async def candles(self, symbol, resolution, start, end):
        days = (end - start) // 86400
        return [{"t": start + i * 86400, "o": 0, "h": 0, "l": 0, "c": 100 + (self._last - 100) * i / days, "v": 0}
                for i in range(days + 1)]


def test_run_once_alerts_on_the_loss_limit(client, monkeypatch):
    who, user = auth("worker-fall"), "worker-fall"
    acc = client.post("/accounts", json={"name": "B", "cash": 0}, headers=who).json()["id"]
    client.post("/holdings", json={"account_id": acc, "symbol": "AAPL", "quantity": 1, "avg_cost": 1}, headers=who)
    client.put("/safety/profile", json={"level": "growth", "max_drawdown_pct": -20, "max_position_pct": 100,
                                        "max_sector_pct": 100}, headers=who)
    for last, expect in ((85, False), (70, True)):  # -15% stays quiet, -30% alerts
        monkeypatch.setattr(worker, "get_provider", lambda last=last: _FallsBy(get_provider(), last))
        asyncio.run(worker.run_once())
        msgs = [a["message"] for a in client.get("/alerts?unread_only=true", headers=who).json()]
        assert any("loss limit" in m for m in msgs) is expect, (user, last, msgs)


def _heartbeat():
    with SessionLocal() as db:
        return db.get(WorkerHeartbeat, ALERT_WORKER)


def test_run_once_records_a_heartbeat_the_health_check_reads(client):
    asyncio.run(worker.run_once())
    beat = _heartbeat()
    assert beat is not None and beat.users_failed == 0 and beat.duration_seconds >= 0
    assert client.get("/health/worker").json()["ok"] is True

    with SessionLocal() as db:  # a worker that stopped finishing passes three intervals ago
        stale = db.get(WorkerHeartbeat, ALERT_WORKER)
        assert stale is not None
        stale.finished_at = datetime.now(UTC) - timedelta(hours=1)
        db.commit()
    r = client.get("/health/worker")
    assert r.status_code == 503 and r.json()["ok"] is False


def test_run_once_stops_between_users_without_a_heartbeat(client):
    asyncio.run(worker.run_once())
    before = _heartbeat().finished_at
    stop = asyncio.Event()
    stop.set()
    assert asyncio.run(worker.run_once(stop)) == 0
    assert _heartbeat().finished_at == before


def test_main_exits_on_sigterm(monkeypatch):
    passes: list[int] = []

    async def fake_pass(stop):
        passes.append(1)
        return 0

    monkeypatch.setattr(worker, "run_once", fake_pass)

    async def run():
        task = asyncio.create_task(worker.main(once=False))  # interval is 300 s: only a signal ends it quickly
        await asyncio.sleep(0.05)
        os.kill(os.getpid(), signal.SIGTERM)
        await asyncio.wait_for(task, 2)

    asyncio.run(run())
    assert passes == [1]


def test_alert_index_allows_one_unread_alert_per_condition(client):
    def alert(read: bool) -> Alert:
        return Alert(user_id="idx", source="watch", ref_id=1, symbol="AAPL", message="m", dedupe_key="watch:1:above", read=read)

    with SessionLocal() as db:
        db.add_all([alert(True), alert(True), alert(False)])  # read ones may repeat
        db.commit()
        db.add(alert(False))
        with pytest.raises(IntegrityError):
            db.commit()
