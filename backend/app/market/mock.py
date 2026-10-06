"""Deterministic fake market data so the app runs end-to-end without any API key."""

import hashlib
import math
import random
import time

from app.market.base import RESOLUTION_SECONDS, Candle, NewsItem, Quote

_KNOWN = {
    "AAPL": ("Apple Inc.", "Technology", 190.0),
    "MSFT": ("Microsoft Corp.", "Technology", 420.0),
    "NVDA": ("NVIDIA Corp.", "Semiconductors", 120.0),
    "GOOGL": ("Alphabet Inc.", "Communication", 170.0),
    "AMZN": ("Amazon.com Inc.", "Consumer", 185.0),
    "TSLA": ("Tesla Inc.", "Automotive", 240.0),
    "SPY": ("SPDR S&P 500 ETF", "ETF", 560.0),
    "TEVA": ("Teva Pharmaceutical", "Healthcare", 18.0),
}


def _seed(*parts: object) -> int:
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:12], 16)


def _base(symbol: str) -> float:
    return _KNOWN.get(symbol, (None, None, 20 + _seed(symbol) % 280))[2]


def _price_at(symbol: str, t: int) -> float:
    """Smooth-ish deterministic walk: drift + a few sine cycles + daily noise."""
    days = t / 86400
    s = _seed(symbol)
    drift = 0.0002 * ((s % 7) - 2)
    cyc = 0.08 * math.sin(days / (20 + s % 30)) + 0.04 * math.sin(days / (5 + s % 7))
    noise = random.Random(_seed(symbol, int(days))).gauss(0, 0.012)
    return round(_base(symbol) * math.exp(drift * (days - 20000) / 10 + cyc + noise), 2)


class MockProvider:
    name = "mock"

    async def quote(self, symbol: str) -> Quote:
        now = int(time.time())
        price = _price_at(symbol, now)
        prev = _price_at(symbol, now - 86400)
        return {
            "symbol": symbol,
            "price": price,
            "change": round(price - prev, 2),
            "change_pct": round((price / prev - 1) * 100, 2),
            "prev_close": prev,
            "ts": now,
        }

    async def candles(self, symbol: str, resolution: str, start: int, end: int) -> list[Candle]:
        step = RESOLUTION_SECONDS.get(resolution, 86400)
        # cap the bar count to keep responses reasonable
        start = max(start, end - step * 2000)
        out: list[Candle] = []
        t = start - start % step
        while t <= end:
            c = _price_at(symbol, t)
            o = _price_at(symbol, t - step) if step >= 86400 else c * (1 + random.Random(_seed(symbol, t, "o")).gauss(0, 0.002))
            r = random.Random(_seed(symbol, t, "hl"))
            h = max(o, c) * (1 + abs(r.gauss(0, 0.006)))
            lo = min(o, c) * (1 - abs(r.gauss(0, 0.006)))
            v = int(1_000_000 * (1 + r.random() * 4))
            out.append({"t": t, "o": round(o, 2), "h": round(h, 2), "l": round(lo, 2), "c": c, "v": v})
            t += step
        return out

    async def metrics(self, symbol: str) -> dict[str, float | None]:
        r = random.Random(_seed(symbol, "metrics"))
        return {
            "pe": round(r.uniform(8, 45), 2),
            "forward_pe": round(r.uniform(8, 40), 2),
            "pb": round(r.uniform(1, 15), 2),
            "ps": round(r.uniform(1, 12), 2),
            "peg": round(r.uniform(0.5, 3), 2),
            "eps": round(_base(symbol) / r.uniform(10, 40), 2),
            "roe": round(r.uniform(-5, 60), 2),
            "roa": round(r.uniform(-2, 25), 2),
            "gross_margin": round(r.uniform(20, 75), 2),
            "net_margin": round(r.uniform(-5, 35), 2),
            "debt_to_equity": round(r.uniform(0, 2.5), 2),
            "current_ratio": round(r.uniform(0.6, 3.5), 2),
            "dividend_yield": round(r.uniform(0, 4), 2),
            "beta": round(r.uniform(0.5, 2), 2),
            "week52_high": round(_base(symbol) * 1.25, 2),
            "week52_low": round(_base(symbol) * 0.75, 2),
        }

    async def news(self, symbol: str, days: int = 14) -> list[NewsItem]:
        now = int(time.time())
        topics = ["earnings preview", "analyst upgrade", "new product launch", "sector rotation", "guidance update"]
        return [
            {
                "headline": f"{symbol}: {topic} (sample)",
                "summary": "Sample headline from the mock provider. Set MARKET_PROVIDER=finnhub for real news.",
                "url": "",
                "source": "mock",
                "datetime": now - i * 86400 * max(1, days // 5),
                "image": "",
            }
            for i, topic in enumerate(topics)
        ]

    async def profile(self, symbol: str) -> dict:
        name, industry, _ = _KNOWN.get(symbol, (f"{symbol} Corp.", "Unknown", 0))
        return {
            "symbol": symbol,
            "name": name,
            "industry": industry,
            "exchange": "NASDAQ",
            "currency": "USD",
            "logo": "",
            "market_cap": round(_base(symbol) * 5e9 / 1e6, 0),  # millions
        }

    async def search(self, query: str) -> list[dict]:
        q = query.upper()
        hits = [{"symbol": s, "name": v[0]} for s, v in _KNOWN.items() if q in s or q in v[0].upper()]
        return hits or [{"symbol": q, "name": f"{q} (unverified)"}]
