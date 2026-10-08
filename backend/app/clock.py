"""The current time, injected so cooling-off waits and holding ages can be tested without waiting."""

from collections.abc import Callable
from datetime import UTC, datetime

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


def get_clock() -> Clock:
    """FastAPI dependency; tests override it with a fixed or advancing clock."""
    return utc_now
