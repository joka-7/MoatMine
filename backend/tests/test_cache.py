"""The TTL cache: expiry, eviction order, lock pruning and per-key single flight (fake clock)."""

import asyncio

import pytest

from app import cache


@pytest.fixture(autouse=True)
def empty_cache(monkeypatch):
    monkeypatch.setattr(cache, "_MAX_ENTRIES", 3)
    cache.clear()
    yield
    cache.clear()


class Clock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


@pytest.mark.parametrize(
    ("elapsed", "expected"),
    [(0, "v"), (9.99, "v"), (10, cache.MISS), (11, cache.MISS)],
)
def test_get(elapsed, expected):
    clock = Clock()
    cache.put(("k",), "v", 10, clock)
    clock.t += elapsed
    assert cache.get(("k",), clock) == expected


@pytest.mark.parametrize(
    ("ttls", "advance", "survivors"),
    [
        ((100, 100, 100), 0, {"b", "c", "d"}),  # none expired: the oldest goes
        ((100, 5, 100), 10, {"a", "c", "d"}),  # an expired entry goes before any live one
        ((5, 5, 5), 10, {"d"}),  # every expired entry is swept, not just one
    ],
)
def test_put_evicts_expired_then_oldest(ttls, advance, survivors):
    clock = Clock()
    for name, ttl in zip("abc", ttls, strict=True):
        cache.put((name,), name, ttl, clock)
    clock.t += advance
    cache.put(("d",), "d", 100, clock)
    assert {k[0] for k in cache._store} == survivors


def test_put_refreshing_a_key_makes_it_newest():
    clock = Clock()
    for name in "abc":
        cache.put((name,), name, 100, clock)
    cache.put(("a",), "a2", 100, clock)
    cache.put(("d",), "d", 100, clock)
    assert [k[0] for k in cache._store] == ["c", "a", "d"]


def test_ttl_cache_computes_once_per_key_and_prunes_idle_locks():
    calls: list[int] = []

    @cache.ttl_cache(60)
    async def square(_provider: object, n: int) -> int | None:
        calls.append(n)
        await asyncio.sleep(0)
        return None if n == 0 else n * n

    async def run() -> list[int | None]:
        return await asyncio.gather(*(square("p", 2) for _ in range(5)), square("p", 0), square("p", 0))

    assert asyncio.run(run()) == [4] * 5 + [None, None]
    assert calls == [2, 0]  # concurrent callers share one computation; None is cached too
    for n in (3, 4, 5):  # fill past the 3-entry cap so eviction runs
        asyncio.run(square("p", n))
    assert set(cache._locks) <= set(cache._store)
