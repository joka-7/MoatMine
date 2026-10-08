"""Tiny in-process TTL cache for expensive, user-independent market computations.

Per process only (each Render instance has its own); swap for Redis if you scale out.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable, Coroutine
from functools import wraps
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
T = TypeVar("T")

Key = tuple[object, ...]

# key -> (expires_at, value), in insertion order so the oldest entry is first
_store: dict[Key, tuple[float, object]] = {}
_locks: dict[Key, asyncio.Lock] = {}
_MAX_ENTRIES = 2_000
MISS = object()  # cached values may themselves be None


def get(key: Key, now: Callable[[], float] = time.monotonic) -> object:
    """The cached value for `key`, or MISS if missing or expired."""
    hit = _store.get(key)
    return hit[1] if hit and now() < hit[0] else MISS


def put(key: Key, value: object, seconds: float, now: Callable[[], float] = time.monotonic) -> None:
    """Store `value` for `seconds`, evicting expired then oldest entries when full."""
    _store.pop(key, None)  # re-insert at the end: the dict order is the age order
    if len(_store) >= _MAX_ENTRIES:
        _evict(now())
    _store[key] = (now() + seconds, value)


def _evict(at: float) -> None:
    for k in [k for k, (expires, _) in _store.items() if expires <= at]:
        del _store[k]
    while len(_store) >= _MAX_ENTRIES:
        del _store[next(iter(_store))]
    # a lock is only needed while its key is being computed; idle ones go with their entries
    for k in [k for k, lock in _locks.items() if k not in _store and not lock.locked()]:
        del _locks[k]


def ttl_cache(seconds: float) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Coroutine[object, object, T]]]:
    """Cache an async function's result by its arguments for `seconds`.

    Positional/keyword args must be hashable; the first argument (the provider) is keyed by its
    `name` so a cached value never crosses data sources.
    """

    def deco(fn: Callable[P, Awaitable[T]]) -> Callable[P, Coroutine[object, object, T]]:
        @wraps(fn)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            head = (getattr(args[0], "name", args[0]),) if args else ()
            key = (fn.__qualname__, *head, *args[1:], *sorted(kwargs.items()))
            if (hit := get(key)) is not MISS:
                return hit  # type: ignore[return-value]
            async with _locks.setdefault(key, asyncio.Lock()):  # one computation per key at a time
                if (hit := get(key)) is not MISS:
                    return hit  # type: ignore[return-value]
                value = await fn(*args, **kwargs)
                put(key, value, seconds)
                return value

        return wrapper

    return deco


def clear() -> None:
    _store.clear()
    _locks.clear()
