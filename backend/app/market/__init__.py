import logging
from functools import lru_cache
from typing import TYPE_CHECKING, Any

import httpx

from app.config import get_settings
from app.jsontypes import JSONDict
from app.market.base import FUNDAMENTAL_KEYS, Candle, MarketProvider, NewsItem, Quote

if TYPE_CHECKING:
    from app.market.fmp import FMPProvider

logger = logging.getLogger(__name__)

# what an FMP call can fail with: network/plan errors, or a response shaped differently than mapped
_FMP_FAILURES = (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError)


def describe_error(e: BaseException) -> dict[str, object]:
    """Loggable fields for a provider error. Never the message: httpx errors embed the URL and its apikey."""
    status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else None
    return {"error": type(e).__name__, "status_code": status}


class RoutedProvider:
    """Primary provider (mock / finnhub) for everything; if FMP is configured, company
    profiles, statements, price targets, dividends and splits come from FMP first.
    Any FMP error falls back to the primary, so a missing plan feature never breaks a page; each
    fallback is logged so a revoked key or exhausted quota shows up in the logs."""

    def __init__(self, primary: MarketProvider, fmp: "FMPProvider | None" = None):
        self.primary = primary
        self.fmp = fmp
        self.name = primary.name + ("+fmp" if fmp else "")

    # everything FMP doesn't cover goes straight to the primary
    async def quote(self, symbol: str) -> Quote:
        return await self.primary.quote(symbol)

    async def candles(self, symbol: str, resolution: str, start: int, end: int) -> list[Candle]:
        return await self.primary.candles(symbol, resolution, start, end)

    async def metrics(self, symbol: str) -> dict[str, float | None]:
        return await self.primary.metrics(symbol)

    async def news(self, symbol: str, days: int = 14) -> list[NewsItem]:
        return await self.primary.news(symbol, days)

    async def profile(self, symbol: str) -> JSONDict:
        return await self.primary.profile(symbol)

    async def search(self, query: str) -> list[JSONDict]:
        return await self.primary.search(query)

    async def earnings(self, symbol: str) -> list[JSONDict]:
        return await self.primary.earnings(symbol)

    async def recommendations(self, symbol: str) -> list[JSONDict]:
        return await self.primary.recommendations(symbol)

    async def _try_fmp(self, method: str, symbol: str) -> Any:  # whatever that FMP method returns
        if self.fmp:
            try:
                out = await getattr(self.fmp, method)(symbol)
                if out:
                    return out
            except _FMP_FAILURES as e:
                logger.warning("fmp failed; using primary provider", extra={"method": method, "symbol": symbol, **describe_error(e)})
        return await getattr(self.primary, method)(symbol)

    async def company(self, symbol: str) -> JSONDict:
        out: JSONDict = await self._try_fmp("company", symbol)
        return out

    async def price_target(self, symbol: str) -> JSONDict | None:
        out: JSONDict | None = await self._try_fmp("price_target", symbol)
        return out

    async def dividends(self, symbol: str) -> list[JSONDict]:
        out: list[JSONDict] = await self._try_fmp("dividends", symbol)
        return out

    async def splits(self, symbol: str) -> list[JSONDict]:
        out: list[JSONDict] = await self._try_fmp("splits", symbol)
        return out

    async def history(self, symbol: str) -> list[JSONDict]:
        out: list[JSONDict] = await self._try_fmp("history", symbol)
        return out

    async def fundamentals(self, symbol: str) -> JSONDict:
        base = await self.primary.fundamentals(symbol)
        if not self.fmp:
            return base
        try:
            f = await self.fmp.fundamentals(symbol)
        except _FMP_FAILURES as e:
            logger.warning("fmp failed; using primary provider", extra={"method": "fundamentals", "symbol": symbol, **describe_error(e)})
            return base
        # FMP wins where it has a value; primary fills the gaps (e.g. 5y growth rates)
        merged = {k: f.get(k) if f.get(k) is not None else base.get(k) for k in FUNDAMENTAL_KEYS}
        merged["statements"] = f.get("statements") or base.get("statements")
        return merged


@lru_cache
def get_provider() -> RoutedProvider:
    s = get_settings()
    if s.market_provider == "finnhub" and s.finnhub_api_key:
        from app.market.finnhub import FinnhubProvider

        primary: MarketProvider = FinnhubProvider(s.finnhub_api_key)
    else:
        from app.market.mock import MockProvider

        primary = MockProvider()
    fmp = None
    if s.fmp_api_key:
        from app.market.fmp import FMPProvider

        fmp = FMPProvider(s.fmp_api_key)
    return RoutedProvider(primary, fmp)
