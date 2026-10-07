"""Value estimator: classic fair-value models, valuation indicators and quality scores.

Every model is a pure function of `fundamentals` + `Assumptions`, returns per-share value or a
reason it was skipped, and is shown side by side so no single model is trusted blindly.
Outputs are model estimates, not advice.
"""

import math
from dataclasses import asdict, dataclass
from statistics import median


@dataclass
class Assumptions:
    discount_rate: float = 9.0  # % required return (WACC proxy)
    growth_rate: float | None = None  # % for stage 1; None -> 5y EPS growth clamped to [0, 20], else 8
    terminal_growth: float = 2.5  # % perpetual growth after stage 1
    years: int = 10  # stage-1 length
    margin_of_safety: float = 25.0  # % discount to fair value for a "buy below" price
    bond_yield: float = 4.5  # % AAA corporate yield for the Graham formula
    pe_multiple: float = 18.0  # fair P/E for the multiple model
    ev_ebitda_multiple: float = 12.0  # fair EV/EBITDA
    dividend_growth: float = 4.0  # % for the dividend discount model

    def resolved_growth(self, f: dict) -> tuple[float, str]:
        if self.growth_rate is not None:
            return self.growth_rate, "user"
        g = f.get("eps_growth_5y")
        if g is None:
            return 8.0, "default"
        return max(0.0, min(20.0, g)), "5y EPS growth (clamped 0–20%)"


def _pos(*vals) -> bool:
    return all(isinstance(v, (int, float)) and v > 0 for v in vals)


def _model(key: str, name: str, value: float | None, formula: str, skipped: str | None = None) -> dict:
    v = round(value, 2) if value is not None and math.isfinite(value) and value > 0 else None
    if value is not None and v is None and not skipped:
        skipped = "model gives a non-positive value"
    return {"key": key, "name": name, "value": v, "formula": formula, "skipped": skipped if v is None else None}


# ---------------- models ----------------


def dcf(base_cf: float, g: float, gt: float, r: float, years: int) -> float:
    """Two-stage DCF per share: `years` of growth g, then Gordon terminal at gt. Rates in %."""
    g, gt, r = g / 100, gt / 100, r / 100
    if r <= gt:
        raise ValueError("discount rate must exceed terminal growth")
    pv, cf = 0.0, base_cf
    for t in range(1, years + 1):
        cf *= 1 + g
        pv += cf / (1 + r) ** t
    terminal = cf * (1 + gt) / (r - gt)
    return pv + terminal / (1 + r) ** years


def graham_number(eps: float, bvps: float) -> float:
    return math.sqrt(22.5 * eps * bvps)


def graham_formula(eps: float, g: float, bond_yield: float) -> float:
    """Graham's revised formula: V = EPS × (8.5 + 2g) × 4.4 / Y."""
    return eps * (8.5 + 2 * g) * 4.4 / bond_yield


def lynch(eps: float, g: float, dividend_yield: float) -> float:
    """Peter Lynch: fair P/E ≈ growth + dividend yield (PEG of 1), capped at 50."""
    return eps * min(50.0, g + dividend_yield)


def ddm(dps: float, gd: float, r: float) -> float:
    """Gordon growth dividend discount: D1 / (r − g)."""
    if r <= gd:
        raise ValueError("discount rate must exceed dividend growth")
    return dps * (1 + gd / 100) / ((r - gd) / 100)


def epv(eps: float, r: float) -> float:
    """Earnings power value: today's earnings as a no-growth perpetuity."""
    return eps / (r / 100)


def ev_ebitda_value(ebitda: float, multiple: float, net_debt: float, shares: float) -> float:
    return (ebitda * multiple - net_debt) / shares


# ---------------- quality scores ----------------


def piotroski(cur: dict | None, prior: dict | None) -> dict:
    """Piotroski F-score (0–9). Needs two years of statements."""
    if not cur or not prior:
        return {"score": None, "checks": [], "skipped": "needs two years of financial statements"}
    try:
        roa = cur["net_income"] / cur["total_assets"]
        roa_p = prior["net_income"] / prior["total_assets"]
        lev = (cur["long_term_debt"] or 0) / cur["total_assets"]
        lev_p = (prior["long_term_debt"] or 0) / prior["total_assets"]
        cr = cur["current_assets"] / cur["current_liabilities"]
        cr_p = prior["current_assets"] / prior["current_liabilities"]
        gm = cur["gross_profit"] / cur["revenue"]
        gm_p = prior["gross_profit"] / prior["revenue"]
        at = cur["revenue"] / cur["total_assets"]
        at_p = prior["revenue"] / prior["total_assets"]
    except (TypeError, ZeroDivisionError, KeyError):
        return {"score": None, "checks": [], "skipped": "statements are missing fields"}
    checks = [
        ("Positive ROA", roa > 0),
        ("Positive operating cash flow", (cur["operating_cash_flow"] or 0) > 0),
        ("ROA improving", roa > roa_p),
        ("Cash flow exceeds net income", (cur["operating_cash_flow"] or 0) > cur["net_income"]),
        ("Leverage falling", lev < lev_p),
        ("Current ratio improving", cr > cr_p),
        ("No share dilution", (cur.get("shares") or 0) <= (prior.get("shares") or 0)),
        ("Gross margin improving", gm > gm_p),
        ("Asset turnover improving", at > at_p),
    ]
    score = sum(ok for _, ok in checks)
    band = "strong" if score >= 7 else "weak" if score <= 3 else "average"
    return {"score": score, "band": band, "checks": [{"name": n, "pass": bool(ok)} for n, ok in checks], "skipped": None}


def altman_z(cur: dict | None, market_cap: float | None) -> dict:
    """Altman Z-score (original public-company version). market_cap in millions."""
    if not cur or not market_cap:
        return {"score": None, "zone": None, "skipped": "needs financial statements and market cap"}
    try:
        ta = cur["total_assets"]
        z = (
            1.2 * (cur["current_assets"] - cur["current_liabilities"]) / ta
            + 1.4 * cur["retained_earnings"] / ta
            + 3.3 * cur["ebit"] / ta
            + 0.6 * market_cap / cur["total_liabilities"]
            + 1.0 * cur["revenue"] / ta
        )
    except (TypeError, ZeroDivisionError, KeyError):
        return {"score": None, "zone": None, "skipped": "statements are missing fields"}
    zone = "safe" if z > 2.99 else "grey" if z >= 1.81 else "distress"
    return {"score": round(z, 2), "zone": zone, "skipped": None}


# ---------------- assemble ----------------


def estimate(price: float, f: dict, a: Assumptions) -> dict:
    eps, bvps, fcf, dps = f.get("eps"), f.get("bvps"), f.get("fcf_per_share"), f.get("dividend_per_share") or 0.0
    g, g_src = a.resolved_growth(f)
    r = a.discount_rate
    dy = dps / price * 100 if price else 0.0

    models = []

    # DCF on free cash flow, falling back to earnings when FCF is missing or negative
    base, basis = (fcf, "FCF/share") if _pos(fcf) else (eps, "EPS (no positive FCF)") if _pos(eps) else (None, "")
    if base is None:
        models.append(_model("dcf", "DCF (2-stage)", None, "", "needs positive FCF or EPS"))
    elif r <= a.terminal_growth:
        models.append(_model("dcf", "DCF (2-stage)", None, "", "discount rate must exceed terminal growth"))
    else:
        models.append(_model("dcf", "DCF (2-stage)", dcf(base, g, a.terminal_growth, r, a.years),
                             f"{basis} {base:.2f}, {a.years}y at {g:.1f}%, then {a.terminal_growth}% at {r}% discount"))

    models.append(_model("graham_number", "Graham number",
                         graham_number(eps, bvps) if _pos(eps, bvps) else None,
                         "√(22.5 × EPS × BVPS)", None if _pos(eps, bvps) else "needs positive EPS and book value"))

    models.append(_model("graham_formula", "Graham formula",
                         graham_formula(eps, min(g, 20), a.bond_yield) if _pos(eps, a.bond_yield) else None,
                         f"EPS × (8.5 + 2×{min(g, 20):.1f}) × 4.4 / {a.bond_yield}", None if _pos(eps) else "needs positive EPS"))

    models.append(_model("lynch", "Peter Lynch fair value",
                         lynch(eps, g, dy) if _pos(eps) else None,
                         f"EPS × (growth {g:.1f} + div. yield {dy:.1f})", None if _pos(eps) else "needs positive EPS"))

    if not _pos(dps):
        models.append(_model("ddm", "Dividend discount", None, "", "no dividend"))
    elif r <= a.dividend_growth:
        models.append(_model("ddm", "Dividend discount", None, "", "discount rate must exceed dividend growth"))
    else:
        models.append(_model("ddm", "Dividend discount", ddm(dps, a.dividend_growth, r),
                             f"D1 {dps * (1 + a.dividend_growth / 100):.2f} / ({r} − {a.dividend_growth})%"))

    models.append(_model("epv", "Earnings power (no growth)", epv(eps, r) if _pos(eps) else None,
                         f"EPS / {r}%", None if _pos(eps) else "needs positive EPS"))

    models.append(_model("pe_multiple", f"P/E multiple ({a.pe_multiple:g}×)",
                         eps * a.pe_multiple if _pos(eps) else None, f"EPS × {a.pe_multiple:g}",
                         None if _pos(eps) else "needs positive EPS"))

    ebitda, nd, sh = f.get("ebitda"), f.get("net_debt"), f.get("shares_outstanding")
    ok = _pos(ebitda, sh) and nd is not None
    models.append(_model("ev_ebitda", f"EV/EBITDA multiple ({a.ev_ebitda_multiple:g}×)",
                         ev_ebitda_value(ebitda, a.ev_ebitda_multiple, nd, sh) if ok else None,
                         f"(EBITDA × {a.ev_ebitda_multiple:g} − net debt) / shares", None if ok else "needs EBITDA, net debt and shares"))

    for m in models:
        m["upside_pct"] = round((m["value"] / price - 1) * 100, 1) if m["value"] and price else None

    vals = [m["value"] for m in models if m["value"]]
    fair = round(median(vals), 2) if vals else None
    buy_below = round(fair * (1 - a.margin_of_safety / 100), 2) if fair else None
    if not fair or not price:
        verdict = "insufficient data"
    elif price <= buy_below:
        verdict = "below buy price"
    elif price <= fair:
        verdict = "below fair value"
    elif price <= fair * 1.15:
        verdict = "near fair value"
    else:
        verdict = "above fair value"

    st = f.get("statements") or {}
    mcap = price * sh if price and sh else None
    pe = price / eps if _pos(eps) and price else None
    indicators = {
        "pe": round(pe, 2) if pe else None,
        "peg": round(pe / g, 2) if pe and g > 0 else None,
        "earnings_yield_pct": round(eps / price * 100, 2) if _pos(eps) and price else None,
        "fcf_yield_pct": round(fcf / price * 100, 2) if fcf is not None and price else None,
        "p_fcf": round(price / fcf, 2) if _pos(fcf) and price else None,
        "pb": round(price / bvps, 2) if _pos(bvps) and price else None,
        "dividend_yield_pct": round(dy, 2),
        "payout_ratio_pct": round(dps / eps * 100, 1) if _pos(eps) and dps else None,
        "ev_ebitda": round((mcap + nd) / ebitda, 2) if mcap and nd is not None and _pos(ebitda) else None,
        "net_debt_to_ebitda": round(nd / ebitda, 2) if nd is not None and _pos(ebitda) else None,
    }

    return {
        "price": price,
        "assumptions": {**asdict(a), "growth_rate": g, "growth_source": g_src},
        "inputs": {k: v for k, v in f.items() if k != "statements"},
        "models": models,
        "summary": {
            "fair_value": fair,
            "low": min(vals) if vals else None,
            "high": max(vals) if vals else None,
            "models_used": len(vals),
            "buy_below": buy_below,
            "upside_pct": round((fair / price - 1) * 100, 1) if fair and price else None,
            "verdict": verdict,
        },
        "indicators": indicators,
        "quality": {
            "piotroski": piotroski(st.get("current"), st.get("prior")),
            "altman_z": altman_z(st.get("current"), mcap),
        },
        "disclaimer": "Model estimates from your assumptions, not investment advice.",
    }
