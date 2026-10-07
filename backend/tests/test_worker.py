import asyncio

from app import worker
from app.db import SessionLocal
from app.market import get_provider
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
