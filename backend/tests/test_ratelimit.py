import pytest

from app.ratelimit import SlidingWindowLimiter


class _Clock:
    def __init__(self) -> None:
        self.t = 1_000.0

    def __call__(self) -> float:
        return self.t


def test_sliding_window_limiter_allows_limit_per_window_per_key():
    clock = _Clock()
    lim = SlidingWindowLimiter(limit=2, window_seconds=60, clock=clock)
    assert lim.retry_after("a") == 0 and lim.retry_after("a") == 0
    assert lim.retry_after("a") == pytest.approx(60)  # third within the window waits for the first to expire
    assert lim.retry_after("b") == 0  # keys are independent
    clock.t += 30
    assert lim.retry_after("a") == pytest.approx(30)
    clock.t += 30.001
    assert lim.retry_after("a") == 0  # the first hit has left the window


def test_market_routes_are_rate_limited_per_user(client, monkeypatch):
    from app import ratelimit

    monkeypatch.setitem(ratelimit._limiters, "market", SlidingWindowLimiter(limit=2, window_seconds=60))
    h = {"Authorization": "Bearer limited-user"}
    codes = [client.get("/stocks/AAPL/quote", headers=h).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    assert client.get("/stocks/AAPL/quote", headers={"Authorization": "Bearer someone-else"}).status_code == 200


@pytest.mark.parametrize(("query", "status"), [
    ("resolution=1&start=0&end=86400000", 422),  # millions of minute bars
    ("resolution=D&start=200&end=100", 422),  # backwards
    ("resolution=1", 200),  # default range shrinks to fit the cap
])
def test_candles_range_is_bounded(client, query, status):
    assert client.get(f"/stocks/AAPL/candles?{query}").status_code == status
