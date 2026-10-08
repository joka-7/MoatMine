"""Retrying market-API GETs against canned responses (no network, no real sleeping)."""

import asyncio

import httpx
import pytest

from app.market.retry import ATTEMPTS, MAX_DELAY_SECONDS, backoff_delay, get_with_retry


@pytest.mark.parametrize(
    ("attempt", "retry_after", "rand", "expected"),
    [
        (1, None, 1.0, 0.5),
        (2, None, 1.0, 1.0),
        (3, None, 0.5, 1.0),
        (10, None, 1.0, MAX_DELAY_SECONDS),  # window capped
        (1, None, 0.0, 0.0),  # full jitter reaches zero
        (1, "2", 0.9, 2.0),  # server's Retry-After wins
        (1, "120", 0.9, MAX_DELAY_SECONDS),  # but is capped
        (1, "Wed, 21 Oct 2026 07:28:00 GMT", 1.0, 0.5),  # HTTP-date form ignored
    ],
)
def test_backoff_delay(attempt, retry_after, rand, expected):
    assert backoff_delay(attempt, retry_after, lambda: rand) == pytest.approx(expected)


def _client(statuses: list[int | Exception]) -> tuple[httpx.AsyncClient, list[int]]:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        s = statuses[min(len(calls), len(statuses)) - 1]
        if isinstance(s, Exception):
            raise s
        return httpx.Response(s, json={"n": len(calls)})

    return httpx.AsyncClient(base_url="https://api.test", transport=httpx.MockTransport(handler)), calls


async def _no_sleep(_s: float) -> None:
    return None


@pytest.mark.parametrize(
    ("statuses", "calls", "outcome"),
    [
        ([200], 1, 200),
        ([429, 200], 2, 200),
        ([503, 502, 200], 3, 200),
        ([httpx.ConnectError("down"), 200], 2, 200),
        ([403], 1, httpx.HTTPStatusError),  # final: no retry
        ([404], 1, httpx.HTTPStatusError),
        ([429], ATTEMPTS, httpx.HTTPStatusError),  # gives up after ATTEMPTS
        ([httpx.ConnectError("down")], ATTEMPTS, httpx.ConnectError),
    ],
)
def test_get_with_retry(statuses, calls, outcome):
    client, made = _client(statuses)
    run = get_with_retry(client, "/x", {}, _no_sleep)
    if isinstance(outcome, int):
        assert asyncio.run(run).status_code == outcome
    else:
        with pytest.raises(outcome):
            asyncio.run(run)
    assert len(made) == calls
