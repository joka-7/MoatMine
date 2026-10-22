"""Where chart bars come from when the primary plan has no candles: FMP, then sample data."""

import asyncio
from datetime import UTC, datetime

import httpx
import pytest

from app import cache
from app.market import RoutedProvider
from app.market.base import Candle
from app.market.finnhub import FinnhubProvider
from app.market.fmp import FMPProvider
from app.market.sources import MOCK_FALLBACK, source_label, track_sources

START = int(datetime(2024, 1, 1, tzinfo=UTC).timestamp())
END = int(datetime(2024, 3, 1, tzinfo=UTC).timestamp())
FMP_ROWS = [
    {"date": "2024-02-02", "open": 11, "high": 13, "low": 10, "close": 12, "volume": 20},
    {"date": "2024-02-01", "open": 10, "high": 12, "low": 9, "close": 11, "volume": 10},
]
FINNHUB_OK = {"s": "ok", "t": [START + 86400], "o": [1], "h": [2], "l": [0.5], "c": [1.5], "v": [5]}


@pytest.fixture(autouse=True)
def fresh_cache():
    cache.clear()


class Calls:
    def __init__(self) -> None:
        self.finnhub = 0
        self.fmp = 0


def routed(finnhub_status: int, fmp_status: int | None, fmp_rows: object = FMP_ROWS) -> tuple[RoutedProvider, Calls]:
    """A router over canned HTTP: Finnhub answers `finnhub_status` (200 = real bars); FMP (None = not configured)."""
    calls = Calls()

    def finnhub(request: httpx.Request) -> httpx.Response:
        calls.finnhub += 1
        return httpx.Response(finnhub_status, json=FINNHUB_OK if finnhub_status == 200 else {"error": "no access"})

    def fmp(request: httpx.Request) -> httpx.Response:
        calls.fmp += 1
        return httpx.Response(fmp_status or 200, json=fmp_rows if fmp_status == 200 else {})

    primary = FinnhubProvider("k", transport=httpx.MockTransport(finnhub))
    second = None if fmp_status is None else FMPProvider("k", transport=httpx.MockTransport(fmp))
    return RoutedProvider(primary, second), calls


def fetch(provider: RoutedProvider, resolution: str = "D") -> tuple[list[Candle], str]:
    async def run() -> tuple[list[Candle], str]:
        with track_sources() as used:
            bars = await provider.candles("AAPL", resolution, START, END)
        return bars, source_label(provider.name, used)

    return asyncio.run(run())


def test_real_finnhub_bars_are_used_and_fmp_is_never_called():
    p, calls = routed(200, 200)
    bars, label = fetch(p)
    assert [b["c"] for b in bars] == [1.5] and label == "finnhub+fmp" and calls.fmp == 0


def test_without_candles_on_the_plan_fmp_end_of_day_bars_replace_the_sample_ones():
    p, calls = routed(403, 200)
    bars, label = fetch(p)
    assert [b["c"] for b in bars] == [11, 12]  # oldest first
    assert label == "finnhub+fmp"  # real prices, not labelled as sample data
    assert calls.fmp == 1


@pytest.mark.parametrize(
    ("fmp_status", "fmp_rows", "why"),
    [(402, None, "the FMP plan refuses it"), (200, [], "FMP has no bars for the symbol"), (None, None, "FMP is not configured")],
)
def test_otherwise_the_chart_shows_sample_bars_labelled_as_such(fmp_status, fmp_rows, why):
    p, _ = routed(403, fmp_status, fmp_rows or [])
    bars, label = fetch(p)
    assert bars and label == MOCK_FALLBACK, why


def test_intraday_charts_keep_using_sample_bars_because_fmp_only_has_daily_history():
    p, calls = routed(403, 200)
    bars, label = fetch(p, "60")
    assert bars and label == MOCK_FALLBACK and calls.fmp == 0


def test_one_fmp_call_serves_repeated_chart_loads_to_protect_the_daily_quota():
    p, calls = routed(403, 200)
    fetch(p)
    fetch(p, "W")
    assert calls.fmp == 1
