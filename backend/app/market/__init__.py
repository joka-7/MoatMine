import logging
from functools import lru_cache

import httpx

from app.config import get_settings
from app.market.base import FUNDAMENTAL_KEYS, MarketProvider

logger = logging.getLogger(__name__)


def describe_error(e: Exception) -> dict[str, object]:
    """Loggable fields for a provider error. Never the message: httpx errors embed the URL and its apikey."""
    status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else None
    return {"error": type(e).__name__, "status_code": status}


class RoutedProvider:
    """Primary provider (mock / finnhub) for everything; if FMP is configured, company
    profiles, statements, price targets, dividends and splits come from FMP first.
    Any FMP error falls back to the primary, so a missing plan feature never breaks a page; each
    fallback is logged so a revoked key or exhausted quota shows up in the logs."""

    def __init__(self, primary: MarketProvider, fmp=None):
        self.primary = primary
        self.fmp = fmp
        self.name = primary.name + ("+fmp" if fmp else "")

    def __getattr__(self, item):  # quote, candles, metrics, news, profile, search, earnings, recommendations
        return getattr(self.primary, item)

    async def _try_fmp(self, method: str, symbol: str):
        if self.fmp:
            try:
                out = await getattr(self.fmp, method)(symbol)
                if out:
                    return out
            except Exception as e:  # deliberate: any FMP failure degrades to the primary provider
                logger.warning("fmp failed; using primary provider", extra={"method": method, "symbol": symbol, **describe_error(e)})
        return await getattr(self.primary, method)(symbol)

    async def company(self, symbol):
        return await self._try_fmp("company", symbol)

    async def price_target(self, symbol):
        return await self._try_fmp("price_target", symbol)

    async def dividends(self, symbol):
        return await self._try_fmp("dividends", symbol)

    async def splits(self, symbol):
        return await self._try_fmp("splits", symbol)

    async def history(self, symbol):
        return await self._try_fmp("history", symbol)

    async def fundamentals(self, symbol):
        base = await self.primary.fundamentals(symbol)
        if not self.fmp:
            return base
        try:
            f = await self.fmp.fundamentals(symbol)
        except Exception as e:  # deliberate: any FMP failure degrades to the primary provider
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

        primary = FinnhubProvider(s.finnhub_api_key)
    else:
        from app.market.mock import MockProvider

        primary = MockProvider()
    fmp = None
    if s.fmp_api_key:
        from app.market.fmp import FMPProvider

        fmp = FMPProvider(s.fmp_api_key)
    return RoutedProvider(primary, fmp)
