"""Moat metrics: is the business durably protected? Pure functions over annual history.

Three signs of a moat, measured over up to 10 years:
  - high, consistent return on invested capital (ROIC),
  - stable gross margins (pricing power),
  - steady revenue growth.
"""

from itertools import pairwise
from statistics import mean, pstdev

from app.jsontypes import JSONDict

TAX_RATE = 0.21  # NOPAT approximation; good enough for ranking, not for valuation
GOOD_ROIC_PCT = 10.0
MIN_YEARS = 4


def roic_pct(row: JSONDict) -> float | None:
    """After-tax operating income ÷ (equity + debt − cash), in %. None if not computable."""
    oi: float | None = row.get("operating_income")
    eq: float | None = row.get("equity")
    debt: float | None = row.get("debt")
    cash: float | None = row.get("cash")
    if oi is None or eq is None:
        return None
    invested = eq + (debt or 0) - (cash or 0)
    if invested <= 0:
        return None
    return oi * (1 - TAX_RATE) / invested * 100


def gross_margin_pct(row: JSONDict) -> float | None:
    rev, gp = row.get("revenue"), row.get("gross_profit")
    return gp / rev * 100 if rev and gp is not None else None


def moat_metrics(history: list[JSONDict]) -> JSONDict | None:
    """Summary of up to 10 years (newest first). None when there are fewer than MIN_YEARS years."""
    rows = [r for r in history if r.get("revenue")][:10]
    if len(rows) < MIN_YEARS:
        return None
    oldest_first = list(reversed(rows))
    roics = [(r["year"], v) for r in oldest_first if (v := roic_pct(r)) is not None]
    margins = [(r["year"], v) for r in oldest_first if (v := gross_margin_pct(r)) is not None]
    revs = [r["revenue"] for r in oldest_first]
    growth = [b / a - 1 for a, b in pairwise(revs) if a]
    years = len(revs) - 1
    cagr = (revs[-1] / revs[0]) ** (1 / years) - 1 if revs[0] and revs[-1] > 0 and years else None
    return {
        "years": len(rows),
        "roic_avg_pct": round(mean(v for _, v in roics), 1) if roics else None,
        "roic_consistency": round(sum(v >= GOOD_ROIC_PCT for _, v in roics) / len(roics), 2) if roics else None,
        "gross_margin_avg_pct": round(mean(v for _, v in margins), 1) if margins else None,
        "gross_margin_std_pp": round(pstdev([v for _, v in margins]), 2) if len(margins) > 1 else None,
        "revenue_cagr_pct": round(cagr * 100, 1) if cagr is not None else None,
        "growth_consistency": round(sum(g > 0 for g in growth) / len(growth), 2) if growth else None,
        "series": [
            {"year": r["year"], "roic_pct": round(v, 1) if (v := roic_pct(r)) is not None else None,
             "gross_margin_pct": round(m, 1) if (m := gross_margin_pct(r)) is not None else None,
             "revenue": r["revenue"]}
            for r in oldest_first
        ],
    }
