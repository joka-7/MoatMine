from typing import Protocol, TypedDict

from app.jsontypes import JSONDict


class Quote(TypedDict):
    symbol: str
    price: float
    change: float
    change_pct: float
    prev_close: float
    ts: int


class Candle(TypedDict):
    t: int  # unix seconds
    o: float
    h: float
    l: float  # noqa: E741
    c: float
    v: float


class NewsItem(TypedDict):
    headline: str
    summary: str
    url: str
    source: str
    datetime: int
    image: str


# resolution: "1", "5", "15", "60" (minutes), "D", "W", "M"
RESOLUTION_SECONDS = {"1": 60, "5": 300, "15": 900, "30": 1800, "60": 3600, "D": 86400, "W": 604800, "M": 2592000}


class MarketProvider(Protocol):
    name: str

    async def quote(self, symbol: str) -> Quote: ...

    async def candles(self, symbol: str, resolution: str, start: int, end: int) -> list[Candle]: ...

    async def metrics(self, symbol: str) -> dict[str, float | None]: ...

    async def news(self, symbol: str, days: int = 14) -> list[NewsItem]: ...

    async def profile(self, symbol: str) -> JSONDict: ...

    async def search(self, query: str) -> list[JSONDict]: ...

    # --- company & research data (all return None / [] when the plan doesn't include it) ---

    async def company(self, symbol: str) -> JSONDict: ...
    # {description, website, employees, ceo, country, ipo, sector, industry, logo}

    async def earnings(self, symbol: str) -> list[JSONDict]: ...
    # [{period, actual, estimate, surprise_pct}] newest first

    async def recommendations(self, symbol: str) -> list[JSONDict]: ...
    # [{period, strong_buy, buy, hold, sell, strong_sell}] newest first

    async def price_target(self, symbol: str) -> JSONDict | None: ...
    # {high, low, mean, median, updated}

    async def dividends(self, symbol: str) -> list[JSONDict]: ...
    # [{date, amount}] newest first

    async def splits(self, symbol: str) -> list[JSONDict]: ...
    # [{date, ratio}] newest first

    async def fundamentals(self, symbol: str) -> JSONDict: ...
    # Inputs for valuation, money values in millions (per-share values in currency):
    # {eps, bvps, fcf_per_share, dividend_per_share, eps_growth_5y, revenue_growth_5y,
    # shares_outstanding, ebitda, net_debt, statements: {current: {...}, prior: {...}} | None}
    # statement keys: revenue, gross_profit, net_income, ebit, operating_cash_flow, total_assets,
    # current_assets, current_liabilities, total_liabilities, long_term_debt, retained_earnings, shares

    async def history(self, symbol: str) -> list[JSONDict]: ...
    # Annual financials, newest first, money in millions:
    # [{year, revenue, gross_profit, operating_income, net_income, equity, debt, cash}]


FUNDAMENTAL_KEYS = [
    "eps", "bvps", "fcf_per_share", "dividend_per_share", "eps_growth_5y", "revenue_growth_5y",
    "shares_outstanding", "ebitda", "net_debt", "roic_5y",
]
STATEMENT_KEYS = [
    "revenue", "gross_profit", "net_income", "ebit", "operating_cash_flow", "total_assets", "current_assets",
    "current_liabilities", "total_liabilities", "long_term_debt", "retained_earnings", "shares",
]
