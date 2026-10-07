"""Tiny in-process TTL cache for expensive, user-independent market computations.

Per process only (each Render instance has its own); swap for Redis if you scale out.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable
from functools import wraps
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
T = TypeVar("T")

_store: dict[tuple, tuple[float, object]] = {}
_MAX_ENTRIES = 2_000


def ttl_cache(seconds: float) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Cache an async function's result by its arguments for `seconds`.

    Positional/keyword args must be hashable; the first argument (the provider) is keyed by its
    `name` so a cached value never crosses data sources.
    """

    def deco(fn: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        locks: dict[tuple, asyncio.Lock] = {}

        @wraps(fn)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            head = (getattr(args[0], "name", args[0]),) if args else ()
            key = (fn.__qualname__, *head, *args[1:], *sorted(kwargs.items()))
            hit = _store.get(key)
            if hit and time.monotonic() - hit[0] < seconds:
                return hit[1]  # type: ignore[return-value]
            lock = locks.setdefault(key, asyncio.Lock())
            async with lock:  # one computation per key at a time
                hit = _store.get(key)
                if hit and time.monotonic() - hit[0] < seconds:
                    return hit[1]  # type: ignore[return-value]
                value = await fn(*args, **kwargs)
                if len(_store) >= _MAX_ENTRIES:
                    _store.clear()
                _store[key] = (time.monotonic(), value)
                return value

        return wrapper

    return deco


def clear() -> None:
    _store.clear()
