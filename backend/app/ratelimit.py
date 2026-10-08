"""Per-user request limits for the routes that spend paid market-data and AI quota.

In process memory, like the caches: correct for the single API instance render.yaml pins
(see docs/HLD.md "Scaling"); a second instance would need a shared store.
"""

import time
from collections import deque
from collections.abc import Callable

from fastapi import Depends, HTTPException

from app.auth import current_user
from app.config import get_settings


class SlidingWindowLimiter:
    """At most `limit` hits per key in any `window_seconds`."""

    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.limit, self.window, self._clock = limit, window_seconds, clock
        self._hits: dict[str, deque[float]] = {}

    def retry_after(self, key: str) -> float:
        """Record a hit and return 0 if it's allowed, else the seconds until the next one would be."""
        now = self._clock()
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return hits[0] + self.window - now
        hits.append(now)
        return 0.0


_limiters: dict[str, SlidingWindowLimiter] = {}


def _limiter(group: str) -> SlidingWindowLimiter:
    if group not in _limiters:
        s = get_settings()
        per_min = {"market": s.rate_limit_market_per_min, "ai": s.rate_limit_ai_per_min}[group]
        _limiters[group] = SlidingWindowLimiter(per_min, 60.0)
    return _limiters[group]


def rate_limited(group: str) -> Callable[[str], None]:
    """FastAPI dependency: authenticate, then count the request against the user's `group` limit.

    Raises:
        HTTPException: 429 with Retry-After when the user is over the limit.
    """

    def check(user: str = Depends(current_user)) -> None:
        wait = _limiter(group).retry_after(user)
        if wait:
            raise HTTPException(429, "Too many requests; slow down.", headers={"Retry-After": str(int(wait) + 1)})

    return check
