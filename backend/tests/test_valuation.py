import math

import pytest

from app import valuation as v

CUR = {
    "revenue": 1000, "gross_profit": 450, "net_income": 120, "ebit": 160, "operating_cash_flow": 150,
    "total_assets": 2000, "current_assets": 600, "current_liabilities": 300, "total_liabilities": 900,
    "long_term_debt": 300, "retained_earnings": 500, "shares": 100,
}
WORSE = {**CUR, "gross_profit": 400, "net_income": 80, "long_term_debt": 400, "current_assets": 500, "revenue": 900, "shares": 105}


def test_models_match_textbook_formulas():
    assert v.graham_number(4, 25) == pytest.approx(math.sqrt(2250))
    assert v.graham_formula(5, 10, 4.4) == pytest.approx(142.5)
    assert v.lynch(2, 15, 2) == pytest.approx(34)
    assert v.lynch(1, 80, 0) == 50  # capped
    assert v.ddm(2, 4, 9) == pytest.approx(41.6)
    assert v.epv(5, 10) == pytest.approx(50)
    assert v.ev_ebitda_value(100, 10, 200, 40) == pytest.approx(20)


def test_dcf_zero_growth_is_a_perpetuity():
    assert v.dcf(1.0, 0, 0, 10, 5) == pytest.approx(10)
    assert v.dcf(1.0, 10, 2, 9, 10) > v.dcf(1.0, 5, 2, 9, 10)
    with pytest.raises(ValueError):
        v.dcf(1, 5, 9, 9, 10)


def test_piotroski():
    good = v.piotroski(CUR, WORSE)
    assert good["score"] == 9 and good["band"] == "strong"
    bad = v.piotroski(WORSE, CUR)
    assert bad["score"] <= 3
    assert v.piotroski(CUR, None)["score"] is None


def test_altman():
    z = v.altman_z(CUR, 3000)
    expected = 1.2 * 300 / 2000 + 1.4 * 500 / 2000 + 3.3 * 160 / 2000 + 0.6 * 3000 / 900 + 1000 / 2000
    assert z["score"] == round(expected, 2) and z["zone"] == "safe"
    assert v.altman_z(CUR, None)["score"] is None


def test_estimate_full():
    f = {"eps": 5, "bvps": 30, "fcf_per_share": 6, "dividend_per_share": 2, "eps_growth_5y": 12,
         "revenue_growth_5y": 8, "shares_outstanding": 100, "ebitda": 900, "net_debt": 500,
         "statements": {"current": CUR, "prior": WORSE}}
    out = v.estimate(100, f, v.Assumptions())
    by = {m["key"]: m for m in out["models"]}
    assert all(by[k]["value"] for k in by), [m for m in out["models"] if not m["value"]]
    assert by["epv"]["value"] == pytest.approx(5 / 0.09, abs=0.01)
    assert out["assumptions"]["growth_rate"] == 12 and "5y" in out["assumptions"]["growth_source"]
    s = out["summary"]
    assert s["low"] <= s["fair_value"] <= s["high"] and s["models_used"] == 8
    assert s["buy_below"] == pytest.approx(s["fair_value"] * 0.75, abs=0.01)
    assert out["indicators"]["pe"] == 20 and out["indicators"]["payout_ratio_pct"] == 40
    assert out["quality"]["piotroski"]["score"] == 9


def test_estimate_loss_maker_and_overrides():
    f = {"eps": -1, "bvps": 5, "fcf_per_share": -0.5, "dividend_per_share": 0, "statements": None}
    out = v.estimate(10, f, v.Assumptions(growth_rate=30))
    assert out["summary"]["verdict"] == "insufficient data"
    assert all(m["skipped"] for m in out["models"])
    assert out["assumptions"]["growth_source"] == "user"
    bad = v.estimate(10, {"eps": 1, "fcf_per_share": 1}, v.Assumptions(discount_rate=2, terminal_growth=3))
    assert next(m for m in bad["models"] if m["key"] == "dcf")["skipped"].startswith("discount rate")
