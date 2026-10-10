"""The scheduler route that starts an alert pass on hosting without background workers."""

import asyncio

import pytest

from app import worker
from app.config import get_settings
from app.routers import internal

TOKEN = "s" * 40


@pytest.fixture
def token(monkeypatch):
    monkeypatch.setattr(get_settings(), "alerts_run_token", TOKEN)


@pytest.mark.parametrize(("configured", "headers", "code"), [
    (False, {"Authorization": f"Bearer {TOKEN}"}, 404),  # no token set: the route is off
    (True, {}, 401),
    (True, {"Authorization": "Bearer wrong"}, 401),
    (True, {"Authorization": f"Bearer {TOKEN}"}, 202),
])
def test_run_alerts_requires_the_token(client, monkeypatch, configured, headers, code):
    monkeypatch.setattr(get_settings(), "alerts_run_token", TOKEN if configured else "")
    monkeypatch.setattr(internal, "_running", None)

    async def no_op_pass() -> int:
        return 0

    monkeypatch.setattr(worker, "run_once", no_op_pass)
    r = client.post("/internal/alerts/run", headers=headers)
    assert r.status_code == code
    if code == 202:
        assert r.json() == {"status": "started"}


def test_run_alerts_starts_one_pass_at_a_time(monkeypatch, token):
    release = asyncio.Event()
    started: list[int] = []

    async def slow_pass() -> int:
        started.append(1)
        await release.wait()
        return 0

    monkeypatch.setattr(worker, "run_once", slow_pass)
    monkeypatch.setattr(internal, "_running", None)

    async def run() -> list[str]:
        first = (await internal.run_alerts())["status"]
        await asyncio.sleep(0)
        second = (await internal.run_alerts())["status"]
        release.set()
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        third = (await internal.run_alerts())["status"]
        await asyncio.sleep(0)
        return [first, second, third]

    assert asyncio.run(run()) == ["started", "already running", "started"]
    assert len(started) == 2
