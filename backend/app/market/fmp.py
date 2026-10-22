"""Financial Modeling Prep — optional source for company descriptions, financial statements,
price targets, dividends and splits (FMP_API_KEY). Uses the /stable API.

Field names follow FMP's documented schema; every read is defensive (.get) so a renamed
field degrades to "—" in the UI instead of an error. Verify against your plan before relying on it.
"""

import asyncio
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from app.jsontypes import JSONDict
from app.market.base import Candle
from app.market.retry import Sleep, get_with_retry

BASE = "https://financialmodelingprep.com/stable"
M = 1_000_000  # FMP returns raw currency units; the app works in millions


def _daily_bar(row: object) -> Candle | None:
    """One FMP end-of-day row as a candle, or None when a field is missing or not a number."""
    if not isinstance(row, dict):
        return None
    try:
        day = date.fromisoformat(str(row["date"])[:10])
        o, h, lo, c = (float(row[k]) for k in ("open", "high", "low", "close"))
    except (KeyError, ValueError, TypeError):
        return None
    volume = row.get("volume")
    return {
        "t": int(datetime(day.year, day.month, day.day, tzinfo=UTC).timestamp()),
        "o": o, "h": h, "l": lo, "c": c,
        "v": float(volume) if isinstance(volume, int | float) else 0.0,
    }


def regroup(bars: list[Candle], resolution: str) -> list[Candle]:
    """Daily bars rolled up to weeks (starting Monday) or months; "D" is returned as it is."""
    if resolution == "D":
        return bars

    def period(bar: Candle) -> tuple[int, int]:
        day = datetime.fromtimestamp(bar["t"], UTC).date()
        if resolution == "W":
            monday = day - timedelta(days=day.weekday())
            return (monday.year, monday.toordinal())
        return (day.year, day.month)

    out: list[Candle] = []
    last: tuple[int, int] | None = None
    for bar in bars:
        key = period(bar)
        if key == last:
            cur = out[-1]
            cur["h"], cur["l"], cur["c"], cur["v"] = max(cur["h"], bar["h"]), min(cur["l"], bar["l"]), bar["c"], cur["v"] + bar["v"]
        else:
            out.append(dict(bar))  # type: ignore[arg-type]
            last = key
    return out


def _mil(v: object) -> float | None:
    return round(v / M, 1) if isinstance(v, int | float) else None


class FMPProvider:
    name = "fmp"

    def __init__(self, api_key: str, transport: httpx.AsyncBaseTransport | None = None,
                 sleep: Sleep = asyncio.sleep):
        self._sleep = sleep  # injected so tests don't wait out the backoff
        self._client = httpx.AsyncClient(base_url=BASE, timeout=15, params={"apikey": api_key}, transport=transport)

    async def _get(self, path: str, **params: str | int) -> Any:  # raw JSON, mapped by each caller
        r = await get_with_retry(self._client, path, dict(params), self._sleep)
        return r.json()

    async def eod_candles(self, symbol: str, resolution: str, start: int, end: int) -> list[Candle]:
        """End-of-day bars between `start` and `end` (unix seconds), as days, weeks ("W") or months ("M").

        Free plans only have daily history, so there is nothing finer than "D". Rows FMP returns
        in a shape we don't recognise are skipped; a plan that refuses the call raises, and the
        caller falls back.
        """
        if resolution not in ("D", "W", "M"):
            raise ValueError(f"FMP end-of-day data has no {resolution!r} bars")
        first = datetime.fromtimestamp(start, UTC).date()
        last = datetime.fromtimestamp(end, UTC).date()
        rows = await self._get("/historical-price-eod/full", symbol=symbol, **{"from": first.isoformat(), "to": last.isoformat()})
        bars = sorted(filter(None, map(_daily_bar, rows if isinstance(rows, list) else [])), key=lambda b: b["t"])
        return regroup([b for b in bars if start <= b["t"] <= end], resolution)

    async def company(self, symbol: str) -> JSONDict:
        rows = await self._get("/profile", symbol=symbol)
        p = rows[0] if rows else {}
        emp = p.get("fullTimeEmployees")
        return {
            "description": p.get("description", ""),
            "website": p.get("website", ""),
            "employees": int(str(emp)) if str(emp or "").isdigit() else None,
            "ceo": p.get("ceo", ""),
            "country": p.get("country", ""),
            "ipo": p.get("ipoDate", ""),
            "sector": p.get("sector", ""),
            "industry": p.get("industry", ""),
            "logo": p.get("image", ""),
        }

    async def price_target(self, symbol: str) -> JSONDict | None:
        rows = await self._get("/price-target-consensus", symbol=symbol)
        d = rows[0] if isinstance(rows, list) and rows else rows if isinstance(rows, dict) else {}
        if not d or d.get("targetConsensus") is None:
            return None
        return {
            "high": d.get("targetHigh"), "low": d.get("targetLow"), "mean": d.get("targetConsensus"),
            "median": d.get("targetMedian"), "updated": "",
        }

    async def dividends(self, symbol: str) -> list[JSONDict]:
        rows = await self._get("/dividends", symbol=symbol)
        return [{"date": r.get("date", ""), "amount": r.get("dividend") or r.get("adjDividend")} for r in rows[:40]]

    async def splits(self, symbol: str) -> list[JSONDict]:
        rows = await self._get("/splits", symbol=symbol)
        return [{"date": r.get("date", ""), "ratio": f"{r.get('numerator', '?')}:{r.get('denominator', '?')}"} for r in rows]

    async def fundamentals(self, symbol: str) -> JSONDict:
        inc = await self._get("/income-statement", symbol=symbol, limit=2)
        bal = await self._get("/balance-sheet-statement", symbol=symbol, limit=2)
        cf = await self._get("/cash-flow-statement", symbol=symbol, limit=2)
        if not (inc and bal and cf):
            return {"statements": None}

        def stmt(i: int) -> JSONDict | None:
            if len(inc) <= i or len(bal) <= i or len(cf) <= i:
                return None
            a, b, c = inc[i], bal[i], cf[i]
            return {
                "revenue": _mil(a.get("revenue")),
                "gross_profit": _mil(a.get("grossProfit")),
                "net_income": _mil(a.get("netIncome")),
                "ebit": _mil(a.get("ebit") or a.get("operatingIncome")),
                "operating_cash_flow": _mil(c.get("operatingCashFlow")),
                "total_assets": _mil(b.get("totalAssets")),
                "current_assets": _mil(b.get("totalCurrentAssets")),
                "current_liabilities": _mil(b.get("totalCurrentLiabilities")),
                "total_liabilities": _mil(b.get("totalLiabilities")),
                "long_term_debt": _mil(b.get("longTermDebt")),
                "retained_earnings": _mil(b.get("retainedEarnings")),
                "shares": _mil(a.get("weightedAverageShsOutDil") or a.get("weightedAverageShsOut")),
            }

        a, b, c = inc[0], bal[0], cf[0]
        shares = a.get("weightedAverageShsOutDil") or a.get("weightedAverageShsOut")
        def per_share(v: object) -> float | None:
            return round(v / shares, 4) if isinstance(v, int | float) and shares else None

        divs = c.get("commonDividendsPaid") or c.get("dividendsPaid")
        return {
            "eps": a.get("epsDiluted") or a.get("eps"),
            "bvps": per_share(b.get("totalStockholdersEquity")),
            "fcf_per_share": per_share(c.get("freeCashFlow")),
            "dividend_per_share": per_share(abs(divs)) if divs else 0.0,
            "eps_growth_5y": None,  # filled by the router from the primary provider
            "revenue_growth_5y": None,
            "shares_outstanding": _mil(shares),
            "ebitda": _mil(a.get("ebitda")),
            "net_debt": _mil(b.get("netDebt")),
            "statements": {"current": stmt(0), "prior": stmt(1)},
        }

    async def history(self, symbol: str) -> list[JSONDict]:
        inc = await self._get("/income-statement", symbol=symbol, limit=10)
        bal = await self._get("/balance-sheet-statement", symbol=symbol, limit=10)
        by_year = {str(b.get("fiscalYear") or b.get("calendarYear") or b.get("date", "")[:4]): b for b in bal}
        rows = []
        for a in inc:
            y = str(a.get("fiscalYear") or a.get("calendarYear") or a.get("date", "")[:4])
            b = by_year.get(y, {})
            rows.append({
                "year": int(y) if y.isdigit() else None,
                "revenue": _mil(a.get("revenue")),
                "gross_profit": _mil(a.get("grossProfit")),
                "operating_income": _mil(a.get("operatingIncome")),
                "net_income": _mil(a.get("netIncome")),
                "equity": _mil(b.get("totalStockholdersEquity")),
                "debt": _mil(b.get("totalDebt")),
                "cash": _mil(b.get("cashAndCashEquivalents")),
            })
        return rows
