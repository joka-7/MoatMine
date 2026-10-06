from functools import lru_cache

from app.config import get_settings
from app.market.base import MarketProvider


@lru_cache
def get_provider() -> MarketProvider:
    s = get_settings()
    if s.market_provider == "finnhub" and s.finnhub_api_key:
        from app.market.finnhub import FinnhubProvider

        return FinnhubProvider(s.finnhub_api_key)
    from app.market.mock import MockProvider

    return MockProvider()
