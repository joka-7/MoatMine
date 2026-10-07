"""Safety score (0–100) for a single stock.

A weighted blend of financial strength, quality, leverage, price risk, crisis behaviour, size,
earnings stability, valuation and moat (return on capital, margin stability, steady growth). Components with no data are left out and the score is
re-normalised over the ones that have data, so a missing feed lowers confidence (reported as
`coverage_pct`) rather than silently scoring as zero.
"""

from dataclasses import dataclass

from app.jsontypes import JSONDict

GRADES = [(80, "A"), (65, "B"), (50, "C"), (35, "D"), (0, "F")]
PENNY_PRICE = 5.0


@dataclass(frozen=True)
class StockFacts:
    """Everything the score needs, gathered by the service layer. None = unknown."""

    price: float | None = None
    altman_zone: str | None = None  # safe | grey | distress
    piotroski: int | None = None  # 0–9
    net_debt_to_ebitda: float | None = None
    volatility_pct: float | None = None  # annualised
    max_drawdown_pct: float | None = None  # negative, over ~5y
    downside_capture_pct: float | None = None  # vs benchmark in past crises
    market_cap_m: float | None = None
    eps_quarters: tuple[float, ...] = ()  # recent quarterly EPS, newest first
    eps_ttm: float | None = None
    fair_value: float | None = None
    # moat (from up to 10 years of annual history; roic_avg_pct may come from a 5y average only)
    roic_avg_pct: float | None = None
    roic_consistency: float | None = None  # share of years with ROIC ≥ 10%, 0–1
    gross_margin_std_pp: float | None = None  # year-to-year spread of gross margin, percentage points
    revenue_cagr_pct: float | None = None
    growth_consistency: float | None = None  # share of years revenue grew, 0–1


def _tiered(value: float, tiers: list[tuple[float, float]], default: float) -> float:
    """First tier whose threshold `value` is at or below wins; `tiers` ascending by threshold."""
    for limit, points in tiers:
        if value <= limit:
            return points
    return default


def _component(name: str, weight: float, points: float | None, value: object, note: str) -> JSONDict:
    return {"name": name, "max": weight, "points": None if points is None else round(points, 1), "value": value, "note": note}


def components(f: StockFacts) -> list[JSONDict]:
    zone_pts = {"safe": 20, "grey": 10, "distress": 0}
    out = [
        _component("Financial strength (Altman Z)", 20, zone_pts.get(f.altman_zone) if f.altman_zone else None,
                   f.altman_zone, "safe 20 · grey 10 · distress 0"),
        _component("Quality (Piotroski F)", 15, f.piotroski / 9 * 15 if f.piotroski is not None else None,
                   f.piotroski, "F-score out of 9, scaled"),
    ]

    if f.net_debt_to_ebitda is None:
        lev = None
    elif f.net_debt_to_ebitda <= 0:
        lev = 10.0  # net cash
    else:
        lev = _tiered(f.net_debt_to_ebitda, [(1, 10), (2, 7), (3, 4)], 0)
    out.append(_component("Debt (net debt / EBITDA)", 10, lev, f.net_debt_to_ebitda, "net cash or ≤1× 10 · ≤2× 7 · ≤3× 4"))

    vol = None if f.volatility_pct is None else _tiered(f.volatility_pct, [(20, 15), (30, 11), (45, 6), (60, 3)], 0)
    out.append(_component("Price volatility", 15, vol, f.volatility_pct, "annualised: ≤20% 15 · ≤30% 11 · ≤45% 6 · ≤60% 3"))

    dd = None if f.max_drawdown_pct is None else _tiered(-f.max_drawdown_pct, [(25, 10), (40, 7), (55, 4)], 0)
    out.append(_component("Worst fall", 10, dd, f.max_drawdown_pct, "worst drop: under 25% 10 · 40% 7 · 55% 4"))

    cap = f.downside_capture_pct
    res = None if cap is None else _tiered(cap, [(80, 10), (100, 7), (120, 4)], 1)
    out.append(_component("Crisis resilience", 10, res, cap, "fall vs market in past crises: ≤80% 10 · ≤100% 7 · ≤120% 4"))

    size = None
    if f.market_cap_m is not None:
        size = next((p for limit, p in [(200_000, 10), (10_000, 8), (2_000, 5), (300, 2)] if f.market_cap_m >= limit), 0)
    out.append(_component("Company size", 10, size, f.market_cap_m, "market cap $M: mega 10 · large 8 · mid 5 · small 2"))

    if f.eps_quarters:
        positive = sum(1 for e in f.eps_quarters if e is not None and e > 0)
        earn = positive / len(f.eps_quarters) * 5
    elif f.eps_ttm is not None:
        earn = 5.0 if f.eps_ttm > 0 else 0.0
    else:
        earn = None
    out.append(_component("Earnings stability", 5, earn, len(f.eps_quarters) or f.eps_ttm, "share of recent quarters with a profit"))

    if f.fair_value and f.price:
        ratio = f.price / f.fair_value
        val = 5.0 if ratio <= 1 else 3.0 if ratio <= 1.15 else 0.0
        val_value: object = round(ratio, 2)
    else:
        val, val_value = None, None
    out.append(_component("Valuation", 5, val, val_value, "price ÷ fair value: ≤1 5 · ≤1.15 3"))
    out.extend(moat_components(f))
    return out


def moat_components(f: StockFacts) -> list[JSONDict]:
    """Return on capital (7), margin stability (4), steady growth (4)."""
    if f.roic_avg_pct is None:
        roic = None
    else:
        base = next((p for limit, p in [(15, 7.0), (10, 5.0), (6, 2.5)] if f.roic_avg_pct >= limit), 0.0)
        # consistency scales it: a moat holds every year, not just on average. Unknown → 75%.
        roic = base * (0.5 + 0.5 * f.roic_consistency) if f.roic_consistency is not None else base * 0.75
    margin = None if f.gross_margin_std_pp is None else _tiered(f.gross_margin_std_pp, [(2, 4), (5, 3), (10, 1.5)], 0)
    if f.growth_consistency is None or f.revenue_cagr_pct is None:
        growth = None
    else:
        cagr_pts = 2.0 if f.revenue_cagr_pct >= 5 else 1.0 if f.revenue_cagr_pct >= 0 else 0.0
        growth = f.growth_consistency * 2 + cagr_pts
    return [
        _component("Return on capital", 7, roic, f.roic_avg_pct,
                   "avg ROIC: ≥15% 7 · ≥10% 5 · ≥6% 2.5, scaled by share of years ≥10%"),
        _component("Margin stability", 4, margin, f.gross_margin_std_pp,
                   "gross-margin spread across years: ≤2pp 4 · ≤5pp 3 · ≤10pp 1.5"),
        _component("Steady growth", 4, growth, f.revenue_cagr_pct,
                   "revenue CAGR ≥5% 2 (≥0% 1) + 2 × share of years revenue grew"),
    ]


def flags(f: StockFacts) -> list[JSONDict]:
    out = []
    if f.price is not None and f.price < PENNY_PRICE:
        out.append({"code": "penny", "severity": "high", "message": f"Penny stock (price under ${PENNY_PRICE:.0f})"})
    if f.altman_zone == "distress":
        out.append({"code": "distress", "severity": "high", "message": "Altman Z in the distress zone (bankruptcy risk)"})
    if f.eps_ttm is not None and f.eps_ttm <= 0:
        out.append({"code": "unprofitable", "severity": "medium", "message": "Not profitable over the last 12 months"})
    if f.volatility_pct is not None and f.volatility_pct > 60:
        out.append({"code": "volatile", "severity": "medium", "message": f"Very volatile ({f.volatility_pct:.0f}% a year)"})
    if f.market_cap_m is not None and f.market_cap_m < 300:
        out.append({"code": "micro_cap", "severity": "medium", "message": "Micro-cap company (under $300M)"})
    if f.net_debt_to_ebitda is not None and f.net_debt_to_ebitda > 4:
        out.append({"code": "leverage", "severity": "medium", "message": f"High debt ({f.net_debt_to_ebitda:.1f}× EBITDA)"})
    return out


# Areas group the components; each gets its own 0–100 score and letter grade.
AREAS = [
    ("financial_health", "Financial health", ["Financial strength (Altman Z)", "Debt (net debt / EBITDA)"]),
    ("quality", "Quality & earnings", ["Quality (Piotroski F)", "Earnings stability"]),
    ("price_risk", "Price risk", ["Price volatility", "Worst fall"]),
    ("resilience", "Crisis resilience", ["Crisis resilience"]),
    ("size", "Size", ["Company size"]),
    ("valuation", "Valuation", ["Valuation"]),
    ("moat", "Moat", ["Return on capital", "Margin stability", "Steady growth"]),
]
TOTAL_WEIGHT = 115  # sum of every component's max points


def grade_for(score: float | None) -> str | None:
    return next(g for limit, g in GRADES if score >= limit) if score is not None else None


def area_grades(comps: list[JSONDict]) -> list[JSONDict]:
    by_name = {c["name"]: c for c in comps}
    out = []
    for key, label, names in AREAS:
        parts = [by_name[n] for n in names if by_name[n]["points"] is not None]
        mx = sum(c["max"] for c in parts)
        score = round(sum(c["points"] for c in parts) / mx * 100) if mx else None
        out.append({"key": key, "name": label, "score": score, "grade": grade_for(score),
                    "weight": round(sum(by_name[n]["max"] for n in names) / TOTAL_WEIGHT * 100)})
    return out


def analyze(areas: list[JSONDict], fl: list[JSONDict], score: int | None, grade: str | None) -> JSONDict:
    """Plain-language reading of the grades: strengths, weaknesses, flags, one-line verdict."""
    known = [a for a in areas if a["grade"]]
    strengths = [a["name"] for a in known if a["grade"] in ("A", "B")]
    weaknesses = [a["name"] for a in known if a["grade"] in ("D", "F")]
    missing = [a["name"] for a in areas if not a["grade"]]
    if score is None:
        verdict = "Not enough data to judge this stock's safety."
    elif any(f["severity"] == "high" for f in fl):
        verdict = "Red flag: " + "; ".join(f["message"] for f in fl if f["severity"] == "high") + "."
    elif grade == "A":
        verdict = "Strong safety profile across the board."
    elif grade == "B":
        verdict = "Solid overall, with a few areas to watch."
    elif grade == "C":
        verdict = "Mixed: real weaknesses sit alongside the strengths."
    else:
        verdict = "Weak safety profile: higher risk than most investors should hold in size."
    lines = []
    if strengths:
        lines.append("Strong on " + ", ".join(s.lower() for s in strengths) + ".")
    if weaknesses:
        lines.append("Weak on " + ", ".join(w.lower() for w in weaknesses) + ".")
    if missing:
        lines.append("No data for " + ", ".join(m.lower() for m in missing) + ", so the score covers less.")
    return {"verdict": verdict, "strengths": strengths, "weaknesses": weaknesses, "missing": missing, "summary": " ".join(lines)}


def safety_score(f: StockFacts) -> JSONDict:
    comps = components(f)
    scored = [c for c in comps if c["points"] is not None]
    total_max = sum(c["max"] for c in scored)
    score = round(sum(c["points"] for c in scored) / total_max * 100) if total_max else None
    fl = flags(f)
    # A high-severity flag caps the score: a distressed or penny stock can't look "safe" on averages.
    if score is not None and any(x["severity"] == "high" for x in fl):
        score = min(score, 34)
    grade = grade_for(score)
    areas = area_grades(comps)
    return {
        "score": score,
        "grade": grade,
        "areas": areas,
        "analysis": analyze(areas, fl, score, grade),
        "coverage_pct": round(total_max / TOTAL_WEIGHT * 100),  # % of the model that had data
        "components": comps,
        "flags": fl,
    }
