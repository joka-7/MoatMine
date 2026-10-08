"""Deterministic fake market data so the app runs end-to-end without any API key."""

import hashlib
import math
import random
import time

from app.jsontypes import JSONDict
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


def _metric_values(symbol: str) -> dict[str, float]:
    """Deterministic sample ratios; every key is always present."""
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
        return {**_metric_values(symbol)}

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

    async def profile(self, symbol: str) -> JSONDict:
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

    async def search(self, query: str) -> list[JSONDict]:
        q = query.upper()
        hits = [{"symbol": s, "name": v[0]} for s, v in _KNOWN.items() if q in s or q in v[0].upper()]
        return hits or [{"symbol": q, "name": f"{q} (unverified)"}]

    # --- company & research data (sample values, labelled as such in the UI) ---

    async def company(self, symbol: str) -> JSONDict:
        name, industry, _ = _KNOWN.get(symbol, (f"{symbol} Corp.", "Unknown", 0))
        r = random.Random(_seed(symbol, "company"))
        return {
            "description": f"{name} is a sample company served by the mock provider. Configure FMP_API_KEY "
            "for real company descriptions.",
            "website": "",
            "employees": r.randint(2_000, 200_000),
            "ceo": "",
            "country": "US",
            "ipo": f"{r.randint(1980, 2015)}-0{r.randint(1, 9)}-1{r.randint(0, 9)}",
            "sector": industry,
            "industry": industry,
            "logo": "",
        }

    async def earnings(self, symbol: str) -> list[JSONDict]:
        m = await self.metrics(symbol)
        q_eps = (m["eps"] or 1) / 4
        out = []
        year, q = time.gmtime().tm_year, (time.gmtime().tm_mon - 1) // 3
        for i in range(8):
            qq, yy = (q - 1 - i) % 4 + 1, year + (q - 1 - i) // 4
            r = random.Random(_seed(symbol, "earn", i))
            est = round(q_eps * (1 - 0.03 * i) , 2)
            act = round(est * (1 + r.gauss(0.03, 0.06)), 2)
            out.append({
                "period": f"{yy}-Q{qq}",
                "actual": act,
                "estimate": est,
                "surprise_pct": round((act / est - 1) * 100, 2) if est else None,
            })
        return out

    async def recommendations(self, symbol: str) -> list[JSONDict]:
        out = []
        for i in range(6):
            r = random.Random(_seed(symbol, "rec", i))
            mon = (time.gmtime().tm_mon - 1 - i) % 12 + 1
            yr = time.gmtime().tm_year - (1 if time.gmtime().tm_mon - 1 - i < 0 else 0)
            out.append({
                "period": f"{yr}-{mon:02d}-01",
                "strong_buy": r.randint(2, 15), "buy": r.randint(5, 20), "hold": r.randint(3, 15),
                "sell": r.randint(0, 4), "strong_sell": r.randint(0, 2),
            })
        return out

    async def price_target(self, symbol: str) -> JSONDict | None:
        p = _price_at(symbol, int(time.time()))
        r = random.Random(_seed(symbol, "pt"))
        mean = p * r.uniform(0.95, 1.25)
        return {
            "high": round(mean * 1.3, 2), "low": round(mean * 0.7, 2), "mean": round(mean, 2),
            "median": round(mean * 1.01, 2), "updated": time.strftime("%Y-%m-%d"),
        }

    async def dividends(self, symbol: str) -> list[JSONDict]:
        m = await self.metrics(symbol)
        dy = m["dividend_yield"] or 0
        if dy < 0.5:
            return []
        per_q = round(_base(symbol) * dy / 100 / 4, 4)
        now = time.time()
        return [
            {"date": time.strftime("%Y-%m-%d", time.gmtime(now - i * 91 * 86400)), "amount": round(per_q * (1 - 0.01 * i), 4)}
            for i in range(12)
        ]

    async def splits(self, symbol: str) -> list[JSONDict]:
        return [{"date": "2020-08-31", "ratio": "4:1"}] if symbol in ("AAPL", "TSLA") else []

    async def fundamentals(self, symbol: str) -> JSONDict:
        m = _metric_values(symbol)
        r = random.Random(_seed(symbol, "fund"))
        shares = 5_000.0  # millions — matches profile market_cap
        eps = m["eps"]
        cur = {
            "revenue": round(eps * shares / (m["net_margin"] / 100 if m["net_margin"] > 1 else 0.1), 1),
        }
        cur["net_income"] = round(eps * shares, 1)
        cur["gross_profit"] = round(cur["revenue"] * m["gross_margin"] / 100, 1)
        cur["ebit"] = round(cur["net_income"] * 1.25, 1)
        cur["operating_cash_flow"] = round(cur["net_income"] * r.uniform(0.9, 1.4), 1)
        cur["total_assets"] = round(cur["revenue"] * r.uniform(0.8, 2.0), 1)
        cur["current_assets"] = round(cur["total_assets"] * r.uniform(0.25, 0.45), 1)
        cur["current_liabilities"] = round(cur["current_assets"] / m["current_ratio"], 1)
        cur["total_liabilities"] = round(cur["total_assets"] * r.uniform(0.3, 0.7), 1)
        cur["long_term_debt"] = round(cur["total_liabilities"] * r.uniform(0.2, 0.6), 1)
        cur["retained_earnings"] = round(cur["total_assets"] * r.uniform(0.1, 0.5), 1)
        cur["shares"] = shares
        g = r.uniform(0.92, 1.05)
        prior = {k: round(v / g * r.uniform(0.97, 1.03), 1) for k, v in cur.items()}
        prior["shares"] = round(shares * r.uniform(0.99, 1.02), 1)
        fcf = cur["operating_cash_flow"] * 0.8
        return {
            "eps": eps,
            "bvps": round(_base(symbol) / m["pb"], 2),
            "fcf_per_share": round(fcf / shares, 2),
            "dividend_per_share": round(_base(symbol) * (m["dividend_yield"] or 0) / 100, 2),
            "eps_growth_5y": round(r.uniform(-3, 25), 2),
            "revenue_growth_5y": round(r.uniform(0, 20), 2),
            "shares_outstanding": shares,
            "ebitda": round(cur["ebit"] * 1.2, 1),
            "net_debt": round(cur["long_term_debt"] - cur["current_assets"] * 0.3, 1),
            "statements": {"current": cur, "prior": prior},
        }

    async def history(self, symbol: str) -> list[JSONDict]:
        m = await self.metrics(symbol)
        r = random.Random(_seed(symbol, "history"))
        growth = r.uniform(-0.02, 0.14)  # company's underlying revenue growth
        margin = (m["gross_margin"] or 40) / 100
        op_margin = max(0.02, (m["net_margin"] or 10) / 100 * 1.3)
        year = time.gmtime().tm_year - 1
        revenue = _base(symbol) * 5_000 / (m["ps"] or 5)  # millions, consistent with mock market cap
        rows = []
        for i in range(10):
            jitter = r.gauss(0, 0.015)
            gm = max(0.05, margin + r.gauss(0, 0.02))
            rows.append({
                "year": year - i,
                "revenue": round(revenue, 1),
                "gross_profit": round(revenue * gm, 1),
                "operating_income": round(revenue * max(0.0, op_margin + jitter), 1),
                "net_income": round(revenue * max(0.0, op_margin + jitter) * 0.78, 1),
                "equity": round(revenue * r.uniform(0.4, 0.9), 1),
                "debt": round(revenue * r.uniform(0.05, 0.4), 1),
                "cash": round(revenue * r.uniform(0.05, 0.25), 1),
            })
            revenue /= 1 + growth + r.gauss(0, 0.04)
        return rows
