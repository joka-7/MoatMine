"""Paper (practice) and real-money accounts are separate books everywhere money is measured."""

import asyncio
import json

import pytest

from app.ai.tools import run_tool
from app.db import SessionLocal
from tests.conftest import auth

P = auth("pat")


@pytest.fixture(scope="module")
def two_books(client):
    """Real: 100k cash + 1 AAPL. Paper: 0 cash + 500 MSFT, i.e. 100% in one stock."""
    real = client.post("/accounts", json={"name": "Broker", "broker": "manual", "cash": 100_000}, headers=P).json()["id"]
    paper = client.post("/accounts", json={"name": "Practice", "broker": "paper", "cash": 0}, headers=P).json()["id"]
    client.put("/safety/profile", json={"level": "growth", "max_position_pct": 8, "max_sector_pct": 100,
                                        "min_safety_score": 0, "max_volatility_pct": 300, "min_market_cap_m": 0,
                                        "allow_penny_stocks": True, "cooling_off_hours": 0}, headers=P)
    client.post("/holdings", json={"account_id": real, "symbol": "AAPL", "quantity": 1, "avg_cost": 100}, headers=P)
    # recorded straight into the DB: the paper book's own rules would (rightly) block this buy
    from app.models import Holding

    with SessionLocal() as db:
        db.add(Holding(user_id="pat", account_id=paper, symbol="MSFT", quantity=500, avg_cost=300))
        db.commit()
    return {"real": real, "paper": paper}


@pytest.mark.parametrize(
    ("query", "symbols", "cash"),
    [("", {"AAPL"}, 100_000), ("?mode=real", {"AAPL"}, 100_000), ("?mode=paper", {"MSFT"}, 0)],
)
def test_portfolio_snapshot_counts_one_book(client, two_books, query, symbols, cash):
    p = client.get(f"/portfolio{query}", headers=P).json()
    assert {h["symbol"] for h in p["holdings"]} == symbols
    assert p["totals"]["cash"] == cash
    assert p["totals"]["net_worth"] == pytest.approx(p["totals"]["invested_value"] + cash)
    assert {a["broker"] == "paper" for a in p["accounts"]} == {p["mode"] == "paper"}


def test_portfolio_snapshot_rejects_unknown_mode(client, two_books):
    assert client.get("/portfolio?mode=both", headers=P).status_code == 422


@pytest.mark.parametrize(("mode", "symbols"), [("real", {"AAPL"}), ("paper", {"MSFT"})])
def test_risk_and_stress_use_one_book(client, two_books, mode, symbols):
    r = client.get(f"/safety/portfolio?mode={mode}", headers=P).json()
    assert r["mode"] == mode and r["holdings_count"] == 1
    assert {b["subject"] for b in r["breaches"] if b["rule"] == "position_size"} == ({"MSFT"} if mode == "paper" else set())
    s = client.get(f"/safety/stress?mode={mode}", headers=P).json()
    worst = {w["symbol"] for sc in s["scenarios"] for w in sc["worst"]}
    assert s["mode"] == mode and worst == symbols


def test_history_uses_one_book(client, two_books):
    real = client.get("/portfolio/history?days=30", headers=P).json()
    paper = client.get("/portfolio/history?days=30&mode=paper", headers=P).json()
    # 1 AAPL is worth a few hundred; 500 MSFT is worth six figures
    assert max(x["value"] for x in real) < 1_000 < min(x["value"] for x in paper)


@pytest.mark.parametrize(("mode", "verdict"), [("real", "pass"), ("paper", "block")])
def test_safety_check_sizes_against_the_target_book(client, two_books, mode, verdict):
    # 2,000 of MSFT is ~2% of the 100k real book; the paper book is already all MSFT, so it stays ~100% there
    r = client.post("/safety/check", json={"symbol": "MSFT", "amount": 2_000, "mode": mode}, headers=P).json()
    pos = next(c for c in r["checks"] if c["rule"] == "position_size")
    assert r["mode"] == mode and (pos["status"] == "fail") is (verdict == "block")


def test_worker_ignores_paper_concentration(client, two_books):
    from app.worker import run_once

    asyncio.run(run_once())
    alerts = client.get("/alerts?unread_only=true", headers=P).json()
    assert not any("MSFT" in a["message"] for a in alerts)


@pytest.mark.parametrize(
    ("tool", "args", "expect"),
    [
        ("get_portfolio", {}, lambda o: {h["symbol"] for h in o["holdings"]} == {"AAPL"}),
        ("get_portfolio", {"mode": "paper"}, lambda o: {h["symbol"] for h in o["holdings"]} == {"MSFT"}),
        ("get_portfolio_risk", {"mode": "paper"}, lambda o: o["mode"] == "paper" and o["holdings_count"] == 1),
        ("get_stress_test", {"mode": "real"}, lambda o: o["mode"] == "real"),
        ("safety_check", {"symbol": "MSFT", "amount": 2_000, "mode": "paper"}, lambda o: o["mode"] == "paper"),
    ],
)
def test_agent_tools_take_a_book_mode(two_books, tool, args, expect):
    with SessionLocal() as db:
        out = json.loads(asyncio.run(run_tool(tool, args, db, "pat")))
    assert expect(out), out


@pytest.mark.parametrize(
    ("broker", "cash", "qty", "status", "cash_after"),
    [
        ("paper", 1_000, 2, 201, 800),  # 2 × 100 paid from paper cash
        ("paper", 1_000, 20, 409, 1_000),  # 2,000 > 1,000: refused, nothing changes
        ("manual", 0, 20, 201, 0),  # real accounts record broker trades; cash is the user's to edit
    ],
)
def test_pay_for_paper_buy_on_add_holding(client, broker, cash, qty, status, cash_after):
    who = auth(f"cashier-{broker}-{qty}")
    loose = {"level": "growth", "max_position_pct": 100, "max_sector_pct": 100, "min_safety_score": 0,
             "max_volatility_pct": 300, "min_market_cap_m": 0, "allow_penny_stocks": True, "cooling_off_hours": 0}
    client.put("/safety/profile", json=loose, headers=who)
    acc = client.post("/accounts", json={"name": "A", "broker": broker, "cash": cash}, headers=who).json()["id"]
    r = client.post("/holdings", json={"account_id": acc, "symbol": "AAPL", "quantity": qty, "avg_cost": 100}, headers=who)
    assert r.status_code == status, r.text
    accounts = {a["id"]: a for a in client.get("/accounts", headers=who).json()}
    assert accounts[acc]["cash"] == cash_after
    held = client.get(f"/portfolio?mode={'paper' if broker == 'paper' else 'real'}", headers=who).json()["holdings"]
    assert len(held) == (1 if status == 201 else 0)


def test_pay_for_paper_buy_on_plan_execute(client):
    who = auth("planner-cash")
    loose = {"level": "growth", "max_position_pct": 100, "max_sector_pct": 100, "min_safety_score": 0,
             "max_volatility_pct": 300, "min_market_cap_m": 0, "allow_penny_stocks": True, "cooling_off_hours": 0}
    client.put("/safety/profile", json=loose, headers=who)
    acc = client.post("/accounts", json={"name": "P", "broker": "paper", "cash": 10}, headers=who).json()["id"]
    plan = client.post("/plans", json={"account_id": acc, "symbol": "MSFT", "quantity": 1,
                                       "note": "Practice buy to test the paper cash balance."}, headers=who).json()
    assert plan["status"] == "ready", plan
    r = client.post(f"/plans/{plan['id']}/execute", headers=who)
    assert r.status_code == 409 and "paper cash" in r.json()["detail"]["message"]
    assert client.get("/portfolio?mode=paper", headers=who).json()["holdings"] == []
