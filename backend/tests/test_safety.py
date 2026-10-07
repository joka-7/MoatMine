from datetime import datetime, timedelta, timezone

import pytest

from app.safety import check as chk
from app.safety import profile as prof
from app.safety import risk
from app.safety.score import StockFacts, safety_score
from tests.conftest import auth

D = auth("dana")
LOOSE = {"level": "growth", "max_position_pct": 100, "max_sector_pct": 100, "min_safety_score": 0,
         "max_volatility_pct": 300, "min_market_cap_m": 0, "allow_penny_stocks": True, "cooling_off_hours": 0}


# ---------------- score ----------------

BEST = StockFacts(price=100, altman_zone="safe", piotroski=9, net_debt_to_ebitda=-0.5, volatility_pct=15,
                  max_drawdown_pct=-10, downside_capture_pct=60, market_cap_m=500_000, eps_quarters=(1, 1, 1, 1),
                  eps_ttm=4, fair_value=120)


def test_score_best_case_is_100_and_grade_a():
    r = safety_score(BEST)
    assert r["score"] == 100 and r["grade"] == "A" and r["coverage_pct"] == 100 and r["flags"] == []


def test_area_grades_and_analysis():
    r = safety_score(StockFacts(price=100, altman_zone="safe", net_debt_to_ebitda=0.5, volatility_pct=70,
                                max_drawdown_pct=-70, market_cap_m=500_000))
    areas = {a["key"]: a for a in r["areas"]}
    assert areas["financial_health"]["grade"] == "A" and areas["price_risk"]["grade"] == "F"
    assert areas["valuation"]["grade"] is None and areas["financial_health"]["weight"] == 30
    a = r["analysis"]
    assert a["strengths"] == ["Financial health", "Size"] and a["weaknesses"] == ["Price risk"]
    assert "Valuation" in a["missing"] and a["summary"].startswith("Strong on financial health, size.")


def test_score_renormalises_missing_components():
    r = safety_score(StockFacts(price=100, volatility_pct=15, market_cap_m=500_000))
    assert r["coverage_pct"] == 25 and r["score"] == 100  # only volatility (15) + size (10) known, both full marks


@pytest.mark.parametrize("facts, code", [
    (StockFacts(price=3, volatility_pct=10), "penny"),
    (StockFacts(price=50, altman_zone="distress"), "distress"),
])
def test_high_severity_flag_caps_score(facts, code):
    r = safety_score(facts)
    assert code in {f["code"] for f in r["flags"]} and r["score"] <= 34


def test_score_no_data():
    assert safety_score(StockFacts())["score"] is None


# ---------------- profile ----------------


@pytest.mark.parametrize("answers, level", [
    ({"horizon": 3, "drop": 3, "goal": 3, "experience": 3, "income": 3}, "growth"),
    ({"horizon": 2, "drop": 2, "goal": 2, "experience": 1, "income": 2}, "balanced"),
    ({"horizon": 0, "drop": 3, "goal": 3, "experience": 3, "income": 3}, "conservative"),  # money needed soon
    ({"horizon": 3, "drop": 0, "goal": 3, "experience": 3, "income": 3}, "conservative"),  # would panic-sell
    ({"horizon": 3, "drop": 3, "goal": 3, "experience": 3, "income": 0}, "moderate"),  # no safety net
])
def test_level_from_answers(answers, level):
    assert prof.level_from_answers(answers) == level


def test_level_rejects_bad_answers():
    with pytest.raises(ValueError):
        prof.level_from_answers({"horizon": 1})


# ---------------- buy check ----------------

RULES = chk.Rules(max_position_pct=10, max_sector_pct=30, min_safety_score=60, max_volatility_pct=35,
                  max_drawdown_pct=-20, min_market_cap_m=2000, allow_penny_stocks=False, cooling_off_hours=24)
BOOK = chk.Book(total_value=10_000, by_symbol={"AAA": 500}, by_sector={"Tech": 2_500})


def cand(**kw):
    base = dict(symbol="AAA", amount=500, sector="Tech", price=100, fair_value=100, market_cap_m=50_000,
                volatility_pct=20, safety={"score": 80, "flags": []})
    return chk.Candidate(**{**base, **kw})


def test_check_pass():
    r = chk.check_buy(RULES, cand(), BOOK)
    assert r["verdict"] == "pass" and not r["requires_note"] and r["cooling_off_hours"] == 0


@pytest.mark.parametrize("kw, rule", [
    (dict(amount=1000), "position_size"),  # (500+1000)/11000 = 13.6% > 10%
    (dict(safety={"score": 40, "flags": []}), "safety_score"),
    (dict(safety={"score": 80, "flags": [{"code": "distress", "severity": "high"}]}), "distress"),
    (dict(safety={"score": 80, "flags": [{"code": "penny", "severity": "high"}]}), "penny"),
])
def test_check_blocks(kw, rule):
    r = chk.check_buy(RULES, cand(**kw), BOOK)
    assert r["verdict"] == "block" and any(c["rule"] == rule and c["status"] == "fail" for c in r["checks"])


@pytest.mark.parametrize("kw, rule", [
    (dict(volatility_pct=50), "volatility"),
    (dict(market_cap_m=500), "size"),
    (dict(price=130, fair_value=100), "valuation"),
    (dict(sector="Tech", amount=900, symbol="BBB"), "sector"),  # (2500+900)/10900 = 31.2% > 30%
])
def test_check_warns_need_note_and_cooling_off(kw, rule):
    r = chk.check_buy(RULES, cand(**kw), BOOK)
    assert r["verdict"] == "warn" and r["requires_note"] and r["cooling_off_hours"] == 24
    assert any(c["rule"] == rule and c["status"] == "warn" for c in r["checks"])


# ---------------- risk maths ----------------


def test_align_keeps_common_days():
    days, closes = risk.align({"A": [(0, 1), (86400, 2), (172800, 3)], "B": [(86400, 5), (172800, 6)]})
    assert days == [86400, 172800] and closes == {"A": [2, 3], "B": [5, 6]}


def test_beta_and_correlation_of_scaled_series():
    bench = [0.01 * ((i % 5) - 2) for i in range(60)]
    asset = [2 * x for x in bench]
    assert risk.beta(asset, bench) == pytest.approx(2)
    assert risk.correlation(asset, bench) == pytest.approx(1)


def test_portfolio_risk_concentration_and_cash():
    closes = {"A": [100 + i for i in range(30)], "B": [50 + (i % 3) for i in range(30)]}
    r = risk.portfolio_risk({"A": 750, "B": 250}, 1000, closes, None, {"A": "Tech", "B": "Energy"})
    assert r["total_value"] == 2000 and r["cash_pct"] == 50
    assert r["top_position_pct"] == 37.5
    assert r["effective_holdings"] == pytest.approx(1 / (0.75**2 + 0.25**2), abs=0.1)
    assert r["sectors"] == {"Tech": 37.5, "Energy": 12.5}
    assert r["correlation"]["symbols"] == ["A", "B"] and r["correlation"]["matrix"][0][0] == 1.0


def test_stress_scenarios_use_actual_fall_then_beta():
    out = risk.stress_scenarios(
        values={"A": 1000, "B": 1000}, cash=2000, betas={"A": 1.5, "B": None},
        crisis_drawdowns={"A": {"gfc": -50.0}, "B": {}}, benchmark_crisis={"gfc": -40.0}, crises=[("gfc", "GFC")],
        shocks=(-20.0,),
    )
    gfc, shock = out
    # A: own -50% → -500; B: not listed, beta defaults 1 × -40% → -400; total -900 of 4000
    assert gfc["change"] == -900 and gfc["change_pct"] == -22.5
    assert {h["symbol"]: h["basis"] for h in gfc["holdings"]} == {"A": "actual fall", "B": "estimated from beta"}
    # A: 1.5 × -20 = -30% → -300; B: 1 × -20 → -200
    assert shock["change"] == -500 and shock["kind"] == "hypothetical"


# ---------------- API ----------------


def test_profile_roundtrip_and_auto_target(client):
    assert client.get("/safety/profile", headers=D).json()["saved"] is False
    r = client.put("/safety/profile", json={"answers": {"horizon": 2, "drop": 2, "goal": 2, "experience": 1, "income": 2},
                                            "max_position_pct": 12}, headers=D)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["saved"] and p["level"] == "balanced" and p["max_position_pct"] == 12 and p["max_sector_pct"] == 30
    targets = {t["name"]: t for t in client.get("/targets", headers=D).json()}
    assert targets["Risk profile (auto)"]["profit_min"] == -25 and targets["Risk profile (auto)"]["risk_max"] == 45
    assert client.put("/safety/profile", json={}, headers=D).status_code == 422


def test_stock_safety_endpoint(client):
    r = client.get("/stocks/msft/safety").json()
    assert r["symbol"] == "MSFT" and 0 <= r["score"] <= 100 and r["grade"] in "ABCDF"
    assert len(r["components"]) == 9 and r["sector"]


def test_plans_flow(client):
    acc = client.post("/accounts", json={"name": "Paper", "broker": "paper", "cash": 100_000}, headers=D).json()["id"]

    client.put("/safety/profile", json={**LOOSE}, headers=D)
    # valuation can still warn (it isn't a profile rule), so give a reason; no cooling-off with 0 hours
    ok = client.post("/plans", json={"account_id": acc, "symbol": "AAPL", "quantity": 1,
                                     "note": "Core position, reviewed the valuation models."}, headers=D).json()
    assert ok["verdict"] in ("pass", "warn") and ok["status"] == "ready", ok
    done = client.post(f"/plans/{ok['id']}/execute", headers=D).json()
    assert done["status"] == "executed" and done["executed_holding_id"]

    client.put("/safety/profile", json={**LOOSE, "max_volatility_pct": 0.1, "cooling_off_hours": 24}, headers=D)
    r = client.post("/plans", json={"account_id": acc, "symbol": "MSFT", "quantity": 1}, headers=D)
    assert r.status_code == 422 and r.json()["detail"]["check"]["verdict"] == "warn"  # needs a reason
    risky = client.post("/plans", json={"account_id": acc, "symbol": "MSFT", "quantity": 1,
                                        "note": "Long-term hold, accepting higher volatility here."}, headers=D).json()
    assert risky["status"] == "cooling_off"
    assert datetime.fromisoformat(risky["available_at"]) > datetime.now(timezone.utc) + timedelta(hours=23)
    assert client.post(f"/plans/{risky['id']}/execute", headers=D).status_code == 409
    assert client.post(f"/plans/{risky['id']}/cancel", headers=D).json()["status"] == "cancelled"

    client.put("/safety/profile", json={**LOOSE, "min_safety_score": 100}, headers=D)
    blocked = client.post("/plans", json={"account_id": acc, "symbol": "NVDA", "quantity": 1}, headers=D).json()
    assert blocked["status"] == "blocked"
    # paper accounts enforce blocks on direct adds too; real accounts only warn
    assert client.post("/holdings", json={"account_id": acc, "symbol": "NVDA", "quantity": 1, "avg_cost": 100}, headers=D).status_code == 409
    real = client.post("/accounts", json={"name": "Real", "cash": 0}, headers=D).json()["id"]
    r = client.post("/holdings", json={"account_id": real, "symbol": "NVDA", "quantity": 1, "avg_cost": 100}, headers=D)
    assert r.status_code == 201 and r.json()["check"]["verdict"] == "block"

    notes = client.get("/stocks/AAPL/notes", headers=D).json()
    assert notes[0]["kind"] == "thesis" and "Core position" in notes[0]["body"]  # the plan's reason becomes a journal entry


def test_portfolio_risk_and_stress_endpoints(client):
    r = client.get("/safety/portfolio", headers=D).json()
    assert r["holdings_count"] >= 1 and r["volatility_pct"] is not None and "breaches" in r
    s = client.get("/safety/stress", headers=D).json()
    assert len(s["scenarios"]) == 9 and all("breaches_limit" in x for x in s["scenarios"])
    assert s["loss_limit_pct"] < 0


def test_ai_analyzer(client, fake_ai):
    from tests.conftest import reply

    fake_ai.plans["anthropic"] = {"scripted": [reply(
        '{"overview": "Solid balance sheet.", "areas": [{"name": "Price risk", "comment": "Swings a lot."}], '
        '"fit": "Fits your balanced rules.", "improve": "Lower volatility."}')]}
    r = client.post("/stocks/AAPL/safety/analyze", headers=D)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["overview"] == "Solid balance sheet." and d["areas"][0]["name"] == "Price risk" and d["fit"]
    req = fake_ai.built["anthropic"].requests[0]
    assert '"user_rules"' in req.messages[-1].content and "not advice" in req.messages[0].content
