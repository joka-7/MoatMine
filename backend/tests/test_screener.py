"""Screener metrics: hand-checkable numbers, then the endpoint."""

from typing import Any

import pytest

from app.errors import MarketDataError
from app.market import get_provider
from app.market.base import Candle
from app.market.mock import MockProvider
from app.screener import price_metrics
from tests.conftest import auth

U = auth("screener-user")
DAY = 86400


def _rising(n: int) -> list[Candle]:
    """Closes 100, 101, ... one a day; each bar's high is 1 above its close and its low 1 below."""
    return [{"t": i * DAY, "o": 100 + i, "h": 101 + i, "l": 99 + i, "c": 100 + i, "v": 1} for i in range(n)]


def test_price_metrics_on_a_steady_climb() -> None:
    m = price_metrics(_rising(300))  # last close 399

    assert m["price"] == 399
    assert m["perf_1m"] == pytest.approx(21 / 378 * 100, abs=0.01)  # 399 against the close 21 trading days back, 378
    assert m["perf_3m"] == 18.75  # 399 / 336
    assert m["perf_6m"] == 46.15  # 399 / 273
    assert m["perf_12m"] == 171.43  # 399 / 147
    assert m["momentum"] == 157.14  # 12-1: the close a month ago, 378, against the close a year ago, 147
    assert m["vs_sma50"] == 6.54  # average of the last 50 closes is 374.5
    assert m["vs_sma200"] == 33.22  # average of the last 200 closes is 299.5
    assert m["high_52w"] == 400 and m["low_52w"] == 147  # the last 252 bars: highs up to 400, the first bar's low is 147
    assert m["pct_from_high"] == -0.25
    assert m["pct_from_low"] == 171.43
    assert m["rsi14"] == 100.0  # every day was a gain
    assert m["max_drawdown_pct"] == 0.0


def test_price_metrics_uses_intraday_extremes_for_the_yearly_range() -> None:
    bars = _rising(260)
    bars[100] = {**bars[100], "h": 900.0, "l": 1.0}
    m = price_metrics(bars)
    assert m["high_52w"] == 900.0 and m["low_52w"] == 1.0


def test_a_short_history_leaves_the_long_windows_unknown() -> None:
    m = price_metrics(_rising(30))
    assert m["perf_1m"] is not None
    assert m["perf_3m"] is None and m["perf_6m"] is None and m["perf_12m"] is None
    assert m["momentum"] is None and m["vs_sma200"] is None and m["vs_sma50"] is None


def test_no_bars_gives_no_metrics() -> None:
    assert price_metrics([]) == {}


def test_a_falling_stock_shows_its_drawdown_and_distance_from_the_high() -> None:
    bars: list[Candle] = [{"t": i * DAY, "o": 0, "h": 200 - i, "l": 200 - i, "c": 200 - i, "v": 1} for i in range(100)]
    m = price_metrics(bars)  # 200 down to 101
    assert m["pct_from_high"] == -49.5
    assert m["max_drawdown_pct"] == -49.5
    assert m["pct_from_low"] == 0.0


def test_endpoint_returns_a_row_per_symbol_in_order_upper_cased_and_without_duplicates(client: Any) -> None:
    r = client.get("/screener/metrics?symbols=msft, AAPL,MSFT", headers=U)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [row["symbol"] for row in body["rows"]] == ["MSFT", "AAPL"]
    assert body["data_source"] == "mock"
    assert {"perf_1m", "momentum", "pct_from_high", "volatility_pct", "pe"} <= body["rows"][0].keys()


@pytest.mark.parametrize(("query", "fragment"), [
    ("", "Field required"),
    ("?symbols=", "at least one symbol"),
    ("?symbols=,,", "at least one symbol"),
    ("?symbols=AAPL,BAD$", "not a ticker symbol: BAD$"),
    ("?symbols=" + ",".join(f"S{i}" for i in range(31)), "at most 30 symbols"),
])
def test_endpoint_rejects_bad_input(client: Any, query: str, fragment: str) -> None:
    r = client.get(f"/screener/metrics{query}", headers=U)
    assert r.status_code == 422 and fragment in r.text


def test_one_symbol_without_data_gets_an_error_row_and_the_others_still_come(client: Any) -> None:
    from app.main import app

    class _OneBroken(MockProvider):
        async def candles(self, symbol: str, resolution: str, start: int, end: int) -> list[Candle]:
            if symbol == "BROKEN":
                raise MarketDataError("no bars for BROKEN")
            return await super().candles(symbol, resolution, start, end)

    app.dependency_overrides[get_provider] = _OneBroken
    try:
        rows = client.get("/screener/metrics?symbols=AAPL,BROKEN", headers=U).json()["rows"]
    finally:
        app.dependency_overrides.clear()

    assert rows[0]["symbol"] == "AAPL" and "error" not in rows[0]
    assert rows[1] == {"symbol": "BROKEN", "error": "MarketDataError"}


def test_endpoint_is_behind_the_market_rate_limit() -> None:
    """The limit authenticates first, then counts: a screener run must not bypass the per-user quota."""
    from app.routers.screener import router

    assert [getattr(d.dependency, "__name__", "") for d in router.dependencies] == ["check"]
