"""Retrying GETs for the upstream market-data APIs.

Free-tier Finnhub and FMP answer bursts with 429 and have the odd 5xx; one retry pass with
exponential backoff and full jitter rides those out without hammering the API. Anything else
(4xx such as 401/403 for a paid endpoint) is final and raised straight away.
"""

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable

import httpx

logger = logging.getLogger(__name__)

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
ATTEMPTS = 3
BASE_DELAY_SECONDS = 0.5
MAX_DELAY_SECONDS = 4.0

Sleep = Callable[[float], Awaitable[None]]


def backoff_delay(attempt: int, retry_after: str | None, rand: Callable[[], float] = random.random) -> float:
    """Seconds to wait before retry number `attempt` (1-based).

    A numeric Retry-After from the server wins (capped); otherwise full jitter over an
    exponentially growing window, so many clients retrying at once spread out.
    """
    if retry_after is not None and retry_after.strip().isdigit():
        return min(float(retry_after), MAX_DELAY_SECONDS)
    return rand() * min(BASE_DELAY_SECONDS * 2.0 ** (attempt - 1), MAX_DELAY_SECONDS)


async def get_with_retry(client: httpx.AsyncClient, path: str, params: dict[str, str | int],
                         sleep: Sleep = asyncio.sleep) -> httpx.Response:
    """GET `path`, retrying 429/5xx and connection errors up to ATTEMPTS times in total.

    Raises:
        httpx.HTTPStatusError: a non-retryable status, or a retryable one on the last attempt.
        httpx.TransportError: the connection kept failing.
    """
    for attempt in range(1, ATTEMPTS + 1):
        last = attempt == ATTEMPTS
        try:
            r = await client.get(path, params=params)
        except httpx.TransportError as e:
            if last:
                raise
            logger.info("market API connection failed; retrying", extra={"path": path, "attempt": attempt, "error": type(e).__name__})
            await sleep(backoff_delay(attempt, None))
            continue
        if r.status_code not in RETRY_STATUSES or last:
            r.raise_for_status()
            return r
        logger.info("market API busy; retrying", extra={"path": path, "attempt": attempt, "status_code": r.status_code})
        await sleep(backoff_delay(attempt, r.headers.get("Retry-After")))
    raise AssertionError("unreachable: the last attempt returns or raises")
