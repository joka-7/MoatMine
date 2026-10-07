"""Results built from fallback (sample) candles say so, however deep the candles were fetched."""

import asyncio

import pytest

from app.crises import bad_times
from app.market.mock import MockProvider
from app.market.sources import MOCK_FALLBACK, note_source
from app.safety.service import stock_safety
from app.targets import risk_by_symbol


class _CandlesFallBack(MockProvider):
    """A 'real' provider whose candle endpoint always falls back to sample data."""

    name = "realish-test"

    async def candles(self, symbol, resolution, start, end):
        note_source(MOCK_FALLBACK)
        return await super().candles(symbol, resolution, start, end)


@pytest.mark.parametrize(
    ("provider", "label"), [(_CandlesFallBack(), MOCK_FALLBACK), (MockProvider(), "mock")]
)
def test_results_are_labelled_with_the_candles_they_used(provider, label):
    assert asyncio.run(bad_times(provider, "AAPL"))["data_source"] == label
    assert asyncio.run(stock_safety(provider, "AAPL"))["data_source"] == label


def test_risk_by_symbol_ignores_sample_candles():
    assert asyncio.run(risk_by_symbol(_CandlesFallBack(), {"AAPL"})) == {"AAPL": None}
    assert asyncio.run(risk_by_symbol(MockProvider(), {"AAPL"}))["AAPL"] > 0
