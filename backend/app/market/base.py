from typing import Protocol, TypedDict


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

    async def profile(self, symbol: str) -> dict: ...

    async def search(self, query: str) -> list[dict]: ...
