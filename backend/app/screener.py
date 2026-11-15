"""Metrics for the stock screener: how a stock has performed, how close it is to its yearly high and
low, how momentum and risk look, and a few valuation ratios.

Everything price-based comes from one year of daily bars, so one candle fetch per stock feeds every
filter. The fundamentals (P/E, dividend yield, beta) come from the provider's metrics.
"""

import asyncio
import logging

import httpx

from app.analytics import TRADING_DAYS, annual_volatility_pct, max_drawdown_pct, rsi, sma
from app.cache import ttl_cache
from app.errors import MarketDataError
from app.jsontypes import JSONDict
from app.market import describe_error
from app.market.base import Candle, MarketProvider
from app.portfolio import cached_daily_candles

logger = logging.getLogger(__name__)

# trading days back for each performance window
WINDOWS = {"perf_1m": 21, "perf_3m": 63, "perf_6m": 126, "perf_12m": 252}
SKIP_DAYS = 21  # momentum skips the latest month: "12-1" is the return from a year ago to a month ago
HISTORY_DAYS = 400  # calendar days fetched: enough for 253 trading days
MAX_SYMBOLS = 30
CONCURRENCY = 4
SYMBOL_TIMEOUT_SECONDS = 20.0  # a feed that is rate-limiting must not hold a whole request up for one company
FUNDAMENTALS_TTL_SECONDS = 6 * 3600


@ttl_cache(FUNDAMENTALS_TTL_SECONDS)
async def _fundamentals(provider: MarketProvider, symbol: str) -> dict[str, float | None]:
    """The provider's ratios for a symbol, kept for hours: P/E, yield and beta barely move in a day."""
    return await provider.metrics(symbol)


def _reason(e: BaseException) -> str:
    """Why a symbol has no numbers, in a word the app can show: busy, slow, or just no data."""
    if isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 429:
        return "rate_limited"
    if isinstance(e, TimeoutError | httpx.TimeoutException):
        return "timeout"
    return "no_data"


def _pct_change(closes: list[float], days_back: int) -> float | None:
    """Return over the last `days_back` trading days, or None if the history is shorter or the start is zero."""
    if len(closes) <= days_back or not closes[-1 - days_back]:
        return None
    return round((closes[-1] / closes[-1 - days_back] - 1) * 100, 2)


def _vs_average(closes: list[float], days: int) -> float | None:
    avg = sma(closes, days)
    return round((closes[-1] / avg - 1) * 100, 2) if avg else None


def price_metrics(bars: list[Candle]) -> JSONDict:
    """Performance, momentum, yearly range and risk from daily bars, oldest first. Unknowns are None.

    The yearly high and low use the last 252 bars' highs and lows, so an intraday extreme counts.
    """
    if not bars:
        return {}
    closes = [b["c"] for b in bars]
    year = bars[-TRADING_DAYS:]
    year_closes = closes[-TRADING_DAYS:]
    high, low = max(b["h"] for b in year), min(b["l"] for b in year)
    price = closes[-1]
    # a year ago to a month ago: the return up to the latest month is left out on purpose
    momentum = None
    if len(closes) > TRADING_DAYS and closes[-1 - TRADING_DAYS]:
        momentum = round((closes[-1 - SKIP_DAYS] / closes[-1 - TRADING_DAYS] - 1) * 100, 2)
    return {
        "price": price,
        **{key: _pct_change(closes, days) for key, days in WINDOWS.items()},
        "momentum": momentum,
        "vs_sma50": _vs_average(closes, 50),
        "vs_sma200": _vs_average(closes, 200),
        "rsi14": rsi(closes),
        "high_52w": high,
        "low_52w": low,
        "pct_from_high": round((price / high - 1) * 100, 2) if high else None,
        "pct_from_low": round((price / low - 1) * 100, 2) if low else None,
        "volatility_pct": annual_volatility_pct(year_closes),
        "max_drawdown_pct": max_drawdown_pct(year_closes),
    }


async def _row(provider: MarketProvider, symbol: str, start: int, end: int, gate: asyncio.Semaphore, timeout: float) -> JSONDict:
    async with gate:
        try:
            async with asyncio.timeout(timeout):
                bars, fundamentals = await asyncio.gather(cached_daily_candles(provider, symbol, start, end), _fundamentals(provider, symbol))
        except (httpx.HTTPError, MarketDataError, TimeoutError) as e:  # one symbol's feed failing must not sink the others; the row says why
            logger.warning("screener: metrics failed", extra={"symbol": symbol, **describe_error(e)})
            return {"symbol": symbol, "error": _reason(e)}
    return {
        "symbol": symbol,
        **price_metrics(bars),
        "pe": fundamentals.get("pe"),
        "dividend_yield": fundamentals.get("dividend_yield"),
        "beta": fundamentals.get("beta"),
    }


async def screen(provider: MarketProvider, symbols: list[str], now: int, timeout: float = SYMBOL_TIMEOUT_SECONDS) -> list[JSONDict]:
    """One row of metrics per symbol, in the order given.

    A symbol whose data could not be fetched has an `error` key: "rate_limited" (the feed said slow
    down), "timeout" (it took longer than `timeout` seconds) or "no_data".
    """
    end = now // 86400 * 86400  # day-aligned so the cached bars are shared by every request that day
    start = end - HISTORY_DAYS * 86400
    gate = asyncio.Semaphore(CONCURRENCY)
    return list(await asyncio.gather(*(_row(provider, s, start, end, gate, timeout) for s in symbols)))
