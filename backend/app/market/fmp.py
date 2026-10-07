"""Financial Modeling Prep — optional source for company descriptions, financial statements,
price targets, dividends and splits (FMP_API_KEY). Uses the /stable API.

Field names follow FMP's documented schema; every read is defensive (.get) so a renamed
field degrades to "—" in the UI instead of an error. Verify against your plan before relying on it.
"""

import httpx

BASE = "https://financialmodelingprep.com/stable"
M = 1_000_000  # FMP returns raw currency units; the app works in millions


def _mil(v):
    return round(v / M, 1) if isinstance(v, (int, float)) else None


class FMPProvider:
    name = "fmp"

    def __init__(self, api_key: str):
        self._client = httpx.AsyncClient(base_url=BASE, timeout=15, params={"apikey": api_key})

    async def _get(self, path: str, **params):
        r = await self._client.get(path, params=params)
        r.raise_for_status()
        return r.json()

    async def company(self, symbol: str) -> dict:
        rows = await self._get("/profile", symbol=symbol)
        p = rows[0] if rows else {}
        emp = p.get("fullTimeEmployees")
        return {
            "description": p.get("description", ""),
            "website": p.get("website", ""),
            "employees": int(emp) if str(emp or "").isdigit() else None,
            "ceo": p.get("ceo", ""),
            "country": p.get("country", ""),
            "ipo": p.get("ipoDate", ""),
            "sector": p.get("sector", ""),
            "industry": p.get("industry", ""),
            "logo": p.get("image", ""),
        }

    async def price_target(self, symbol: str) -> dict | None:
        rows = await self._get("/price-target-consensus", symbol=symbol)
        d = rows[0] if isinstance(rows, list) and rows else rows if isinstance(rows, dict) else {}
        if not d or d.get("targetConsensus") is None:
            return None
        return {
            "high": d.get("targetHigh"), "low": d.get("targetLow"), "mean": d.get("targetConsensus"),
            "median": d.get("targetMedian"), "updated": "",
        }

    async def dividends(self, symbol: str) -> list[dict]:
        rows = await self._get("/dividends", symbol=symbol)
        return [{"date": r.get("date", ""), "amount": r.get("dividend") or r.get("adjDividend")} for r in rows[:40]]

    async def splits(self, symbol: str) -> list[dict]:
        rows = await self._get("/splits", symbol=symbol)
        return [{"date": r.get("date", ""), "ratio": f"{r.get('numerator', '?')}:{r.get('denominator', '?')}"} for r in rows]

    async def fundamentals(self, symbol: str) -> dict:
        inc = await self._get("/income-statement", symbol=symbol, limit=2)
        bal = await self._get("/balance-sheet-statement", symbol=symbol, limit=2)
        cf = await self._get("/cash-flow-statement", symbol=symbol, limit=2)
        if not (inc and bal and cf):
            return {"statements": None}

        def stmt(i: int) -> dict | None:
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
        per_share = lambda v: round(v / shares, 4) if isinstance(v, (int, float)) and shares else None  # noqa: E731
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
