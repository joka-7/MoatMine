"""Finnhub provider. Free tier covers quote, news, metrics, profile, search.

Note: Finnhub's /stock/candle needs a paid plan on most accounts. If it errors,
candles fall back to the mock series so charts still render, and the fallback is
recorded with app.market.sources so every result built on those bars is labelled
as sample data.
"""

import logging
import time
from datetime import date, timedelta

import httpx

from app.market.base import Candle, NewsItem, Quote
from app.market.mock import MockProvider
from app.market.sources import MOCK_FALLBACK, note_source

logger = logging.getLogger(__name__)

BASE = "https://finnhub.io/api/v1"

_METRIC_MAP = {
    "pe": "peTTM",
    "forward_pe": "forwardPE",
    "pb": "pbQuarterly",
    "ps": "psTTM",
    "peg": "pegTTM",
    "eps": "epsTTM",
    "roe": "roeTTM",
    "roa": "roaTTM",
    "gross_margin": "grossMarginTTM",
    "net_margin": "netProfitMarginTTM",
    "debt_to_equity": "totalDebt/totalEquityQuarterly",
    "current_ratio": "currentRatioQuarterly",
    "dividend_yield": "currentDividendYieldTTM",
    "beta": "beta",
    "week52_high": "52WeekHigh",
    "week52_low": "52WeekLow",
}


class FinnhubProvider:
    name = "finnhub"

    def __init__(self, api_key: str, transport: httpx.AsyncBaseTransport | None = None):
        self._client = httpx.AsyncClient(base_url=BASE, timeout=10, params={"token": api_key}, transport=transport)
        self._fallback = MockProvider()

    async def _get(self, path: str, **params):
        r = await self._client.get(path, params=params)
        r.raise_for_status()
        return r.json()

    async def quote(self, symbol: str) -> Quote:
        d = await self._get("/quote", symbol=symbol)
        return {
            "symbol": symbol,
            "price": d.get("c") or 0.0,
            "change": d.get("d") or 0.0,
            "change_pct": d.get("dp") or 0.0,
            "prev_close": d.get("pc") or 0.0,
            "ts": d.get("t") or int(time.time()),
        }

    async def candles(self, symbol: str, resolution: str, start: int, end: int) -> list[Candle]:
        try:
            d = await self._get("/stock/candle", symbol=symbol, resolution=resolution, **{"from": start, "to": end})
            if d.get("s") != "ok":
                return []
            return [
                {"t": t, "o": o, "h": h, "l": lo, "c": c, "v": v}
                for t, o, h, lo, c, v in zip(d["t"], d["o"], d["h"], d["l"], d["c"], d["v"])
            ]
        except httpx.HTTPStatusError as e:
            logger.warning(
                "finnhub candles unavailable; using sample data",
                extra={"symbol": symbol, "status_code": e.response.status_code},
            )
            note_source(MOCK_FALLBACK)
            return await self._fallback.candles(symbol, resolution, start, end)

    async def metrics(self, symbol: str) -> dict[str, float | None]:
        m = (await self._get("/stock/metric", symbol=symbol, metric="all")).get("metric", {})
        return {k: m.get(src) for k, src in _METRIC_MAP.items()}

    async def news(self, symbol: str, days: int = 14) -> list[NewsItem]:
        today = date.today()
        items = await self._get(
            "/company-news", symbol=symbol, **{"from": str(today - timedelta(days=days)), "to": str(today)}
        )
        return [
            {
                "headline": n.get("headline", ""),
                "summary": n.get("summary", ""),
                "url": n.get("url", ""),
                "source": n.get("source", ""),
                "datetime": n.get("datetime", 0),
                "image": n.get("image", ""),
            }
            for n in items[:30]
        ]

    async def profile(self, symbol: str) -> dict:
        p = await self._get("/stock/profile2", symbol=symbol)
        return {
            "symbol": symbol,
            "name": p.get("name", symbol),
            "industry": p.get("finnhubIndustry", ""),
            "exchange": p.get("exchange", ""),
            "currency": p.get("currency", "USD"),
            "logo": p.get("logo", ""),
            "market_cap": p.get("marketCapitalization"),
        }

    async def search(self, query: str) -> list[dict]:
        d = await self._get("/search", q=query)
        return [{"symbol": r["symbol"], "name": r.get("description", "")} for r in d.get("result", [])[:15]]

    # --- company & research data ---
    # Free Finnhub covers profile2, earnings, recommendation trends and splits.
    # Price targets and dividend history are paid on most plans: those return None / [].
    # Company descriptions and financial statements aren't in Finnhub's free data; set
    # FMP_API_KEY and the router sends those calls to FMP instead.

    async def _safe(self, path: str, default, **params):
        try:
            return await self._get(path, **params)
        except httpx.HTTPStatusError:
            return default

    async def company(self, symbol: str) -> dict:
        p = await self._safe("/stock/profile2", {}, symbol=symbol)
        return {
            "description": "",
            "website": p.get("weburl", ""),
            "employees": None,
            "ceo": "",
            "country": p.get("country", ""),
            "ipo": p.get("ipo", ""),
            "sector": p.get("finnhubIndustry", ""),
            "industry": p.get("finnhubIndustry", ""),
            "logo": p.get("logo", ""),
        }

    async def earnings(self, symbol: str) -> list[dict]:
        rows = await self._safe("/stock/earnings", [], symbol=symbol)
        return [
            {
                "period": r.get("period", ""),
                "actual": r.get("actual"),
                "estimate": r.get("estimate"),
                "surprise_pct": r.get("surprisePercent"),
            }
            for r in rows
        ]

    async def recommendations(self, symbol: str) -> list[dict]:
        rows = await self._safe("/stock/recommendation", [], symbol=symbol)
        return [
            {
                "period": r.get("period", ""),
                "strong_buy": r.get("strongBuy", 0), "buy": r.get("buy", 0), "hold": r.get("hold", 0),
                "sell": r.get("sell", 0), "strong_sell": r.get("strongSell", 0),
            }
            for r in rows
        ]

    async def price_target(self, symbol: str) -> dict | None:
        d = await self._safe("/stock/price-target", None, symbol=symbol)
        if not d or d.get("targetMean") is None:
            return None
        return {
            "high": d.get("targetHigh"), "low": d.get("targetLow"), "mean": d.get("targetMean"),
            "median": d.get("targetMedian"), "updated": d.get("lastUpdated", ""),
        }

    async def dividends(self, symbol: str) -> list[dict]:
        today = date.today()
        rows = await self._safe("/stock/dividend", [], symbol=symbol, **{"from": str(today - timedelta(days=365 * 5)), "to": str(today)})
        return sorted(({"date": r.get("exDate") or r.get("date", ""), "amount": r.get("amount")} for r in rows), key=lambda r: r["date"], reverse=True)

    async def splits(self, symbol: str) -> list[dict]:
        today = date.today()
        rows = await self._safe("/stock/split", [], symbol=symbol, **{"from": "2000-01-01", "to": str(today)})
        return sorted(
            ({"date": r.get("date", ""), "ratio": f"{r.get('toFactor', '?')}:{r.get('fromFactor', '?')}"} for r in rows),
            key=lambda r: r["date"], reverse=True,
        )

    async def fundamentals(self, symbol: str) -> dict:
        m = (await self._safe("/stock/metric", {}, symbol=symbol, metric="all")).get("metric", {})
        prof = await self._safe("/stock/profile2", {}, symbol=symbol)

        def first(*keys):
            for k in keys:
                if m.get(k) is not None:
                    return m[k]
            return None

        price = None
        try:
            price = (await self.quote(symbol))["price"]
        except httpx.HTTPError:
            pass
        pfcf = first("pfcfShareTTM", "pfcfShareAnnual")
        ev = first("enterpriseValue")
        ev_ebitda = first("evEbitdaTTM", "currentEv/ebitdaTTM")
        mcap = first("marketCapitalization") or prof.get("marketCapitalization")
        return {
            "eps": first("epsTTM", "epsAnnual"),
            "bvps": first("bookValuePerShareQuarterly", "bookValuePerShareAnnual"),
            "fcf_per_share": round(price / pfcf, 4) if price and pfcf else first("freeCashFlowPerShareTTM"),
            "dividend_per_share": first("dividendPerShareTTM", "dividendPerShareAnnual"),
            "eps_growth_5y": first("epsGrowth5Y"),
            "revenue_growth_5y": first("revenueGrowth5Y"),
            "shares_outstanding": prof.get("shareOutstanding"),
            "ebitda": round(ev / ev_ebitda, 1) if ev and ev_ebitda else None,
            "net_debt": round(ev - mcap, 1) if ev and mcap else None,
            "roic_5y": first("roi5Y"),  # 5-year average return on investment, %
            "statements": None,
        }

    async def history(self, symbol: str) -> list[dict]:
        # Annual statements need FMP (or a paid Finnhub plan); the Moat grade then falls back
        # to the 5-year return-on-investment average in fundamentals()["roic_5y"].
        return []
