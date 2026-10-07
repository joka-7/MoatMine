"""Finnhub provider against canned HTTP responses (no network)."""

import asyncio

import httpx
import pytest

from app.market.finnhub import FinnhubProvider
from app.market.sources import MOCK_FALLBACK, source_label, track_sources

OK_CANDLES = {"s": "ok", "t": [1_700_000_000, 1_700_086_400], "o": [1, 2], "h": [2, 3], "l": [0.5, 1.5], "c": [1.5, 2.5], "v": [10, 20]}


def provider(routes: dict[str, httpx.Response | dict]) -> FinnhubProvider:
    """Finnhub whose HTTP calls are answered from `routes` (path -> response or JSON body); symbol FAIL gets 403."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("symbol") == "FAIL":
            return httpx.Response(403, json={"error": "You don't have access to this resource."})
        r = routes[request.url.path.removeprefix("/api/v1")]
        return r if isinstance(r, httpx.Response) else httpx.Response(200, json=r)

    return FinnhubProvider("test-key", transport=httpx.MockTransport(handler))


@pytest.mark.parametrize(
    ("symbol", "body", "expected_len", "label"),
    [
        ("AAPL", OK_CANDLES, 2, "finnhub"),
        ("AAPL", {"s": "no_data"}, 0, "finnhub"),
        ("FAIL", None, None, MOCK_FALLBACK),  # paid endpoint refused: sample bars, labelled as such
    ],
)
def test_candles_labels_its_source(symbol, body, expected_len, label):
    p = provider({"/stock/candle": body or {}})

    async def run():
        with track_sources() as used:
            bars = await p.candles(symbol, "D", 1_690_000_000, 1_700_100_000)
        return bars, source_label(p.name, used)

    bars, got = asyncio.run(run())
    assert got == label
    assert len(bars) == expected_len if expected_len is not None else len(bars) > 0
    if symbol == "AAPL" and expected_len:
        assert bars[0] == {"t": 1_700_000_000, "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 10}


def test_candles_labels_stay_per_request_under_concurrency():
    p = provider({"/stock/candle": OK_CANDLES})

    async def one(symbol: str) -> str:
        with track_sources() as used:
            await asyncio.sleep(0.01 if symbol == "FAIL" else 0)  # interleave the two requests
            await p.candles(symbol, "D", 1_690_000_000, 1_700_100_000)
            await asyncio.sleep(0.02 if symbol == "AAPL" else 0)
        return source_label(p.name, used)

    async def both():
        return await asyncio.gather(one("FAIL"), one("AAPL"))

    assert asyncio.run(both()) == [MOCK_FALLBACK, "finnhub"]


def test_nested_tracker_reports_to_outer():
    p = provider({"/stock/candle": OK_CANDLES})

    async def run():
        with track_sources() as outer:
            with track_sources() as inner:
                await p.candles("FAIL", "D", 0, 1)
        return outer, inner

    outer, inner = asyncio.run(run())
    assert MOCK_FALLBACK in outer and MOCK_FALLBACK in inner


@pytest.mark.parametrize(
    ("body", "price", "change_pct"),
    [
        ({"c": 190.5, "d": 1.5, "dp": 0.79, "pc": 189.0, "t": 1_700_000_000}, 190.5, 0.79),
        ({"c": 190.5}, 190.5, 0.0),  # missing fields default to 0
    ],
)
def test_quote_maps_fields(body, price, change_pct):
    q = asyncio.run(provider({"/quote": body}).quote("AAPL"))
    assert q["symbol"] == "AAPL" and q["price"] == price and q["change_pct"] == change_pct


def test_research_endpoints_degrade_on_paid_plan_errors():
    p = provider({})
    assert asyncio.run(p.price_target("FAIL")) is None
    assert asyncio.run(p.dividends("FAIL")) == []
    assert asyncio.run(p.earnings("FAIL")) == []


def test_quote_raises_on_http_error():
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(provider({}).quote("FAIL"))
