from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.ai import dispatcher
from tests.conftest import auth

A = auth("alice")
B = auth("bob")


@pytest.fixture(scope="module")
def alice_account(client):
    r = client.post("/accounts", json={"name": "IBKR", "cash": 1000}, headers=A)
    assert r.status_code == 201
    acc = r.json()["id"]
    opened = (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()
    for sym, qty, cost in [("aapl", 10, 150), ("MSFT", 5, 300)]:
        r = client.post("/holdings", json={"account_id": acc, "symbol": sym, "quantity": qty, "avg_cost": cost, "opened_at": opened}, headers=A)
        assert r.status_code == 201
    return acc


def test_health(client):
    assert client.get("/health").json() == {"ok": True, "market_provider": "mock"}


def test_portfolio_totals(client, alice_account):
    p = client.get("/portfolio", headers=A).json()
    syms = {h["symbol"] for h in p["holdings"]}
    assert syms == {"AAPL", "MSFT"}
    t = p["totals"]
    assert t["cost"] == 10 * 150 + 5 * 300
    assert t["net_worth"] == pytest.approx(t["invested_value"] + 1000)
    assert sum(h["weight_pct"] for h in p["holdings"]) == pytest.approx(100, abs=0.05)


def test_user_isolation(client, alice_account):
    assert client.get("/portfolio", headers=B).json()["holdings"] == []
    assert client.post("/holdings", json={"account_id": alice_account, "symbol": "X", "quantity": 1, "avg_cost": 1}, headers=B).status_code == 404


def test_portfolio_history(client, alice_account):
    hist = client.get("/portfolio/history?days=30", headers=A).json()
    assert len(hist) >= 25 and all(p["value"] > 0 for p in hist)


def test_stock_data(client):
    assert client.get("/stocks/aapl/quote").json()["symbol"] == "AAPL"
    r = client.get("/stocks/AAPL/candles?resolution=60")
    assert r.status_code == 200 and r.headers["x-data-source"] == "mock"
    bars = r.json()
    assert bars and all(b["l"] <= min(b["o"], b["c"]) and b["h"] >= max(b["o"], b["c"]) for b in bars)
    assert client.get("/stocks/AAPL/candles?resolution=bad").status_code == 422
    ratios = client.get("/stocks/AAPL/ratios").json()
    assert "pe" in ratios["fundamental"] and ratios["price"]["volatility_pct"] > 0
    assert len(client.get("/stocks/AAPL/news").json()) > 0


def test_notes(client):
    r = client.post("/stocks/nvda/notes", json={"kind": "thesis", "title": "AI capex", "body": "long"}, headers=A)
    assert r.status_code == 201 and r.json()["symbol"] == "NVDA"
    assert len(client.get("/stocks/NVDA/notes", headers=A).json()) == 1
    assert client.get("/stocks/NVDA/notes", headers=B).json() == []
    assert client.delete(f"/stocks/NVDA/notes/{r.json()['id']}", headers=B).status_code == 404


def test_watchlist(client):
    r = client.post("/watchlist", json={"symbol": "tsla", "alert_above": 1}, headers=A)
    assert r.status_code == 201
    assert client.post("/watchlist", json={"symbol": "TSLA"}, headers=A).status_code == 409
    items = client.get("/watchlist", headers=A).json()
    assert items[0]["symbol"] == "TSLA" and items[0]["quote"]["price"] > 0


def test_targets_papi_mami(client, alice_account):
    bad = {"name": "x", "profit_min": 10, "profit_max": 5}
    assert client.post("/targets", json=bad, headers=A).status_code == 422

    t = {
        "name": "Apple swing",
        "symbol": "aapl",
        "profit_target": 25, "profit_min": -1000, "profit_max": -999,  # forces above_max breach
        "amount_min": 0, "amount_max": 1e9,
        "period_target_days": 365, "period_min_days": 30, "period_max_days": 730,
        "intent": "growth", "risk_max": 1000,
    }
    r = client.post("/targets", json=t, headers=A)
    assert r.status_code == 201 and r.json()["symbol"] == "AAPL"
    client.post("/targets", json={"name": "Whole book", "amount_target": 1e7}, headers=A)

    ev = {e["name"]: e for e in client.get("/targets/evaluate", headers=A).json()}
    apple = ev["Apple swing"]
    assert apple["checks"]["profit"]["status"] == "above_max"
    assert apple["checks"]["period"]["status"] == "ok" and apple["checks"]["period"]["value"] == 40
    assert apple["checks"]["intent"]["intent"] == "growth"
    assert apple["breaches"] == ["profit"]
    book = ev["Whole book"]
    assert book["checks"]["amount"]["status"] == "ok" and book["checks"]["amount"]["progress_pct"] < 100


def test_worker_creates_deduped_alerts(client, alice_account):
    import asyncio

    from app.worker import run_once

    first = asyncio.run(run_once())
    assert first >= 2  # AAPL target breach + TSLA watch alert
    assert asyncio.run(run_once()) == 0  # deduped while unread
    alerts = client.get("/alerts?unread_only=true", headers=A).json()
    assert any("Apple swing" in a["message"] for a in alerts)
    assert client.post("/alerts/read-all", headers=A).status_code == 204
    assert client.get("/alerts?unread_only=true", headers=A).json() == []


def test_ai_keys_are_encrypted_and_masked(client):
    r = client.put("/ai/keys", json={"provider": "openai", "api_key": "sk-test-1234567890abcd"}, headers=A)
    assert r.status_code == 200 and r.json()["masked"] == "sk-t…abcd"
    from app.db import SessionLocal
    from app.models import AIKey

    with SessionLocal() as db:
        row = db.query(AIKey).filter_by(user_id="alice", provider="openai").one()
        assert "sk-test" not in row.encrypted_key
    assert client.put("/ai/keys", json={"provider": "external", "api_key": "k", "base_url": "http://x"}, headers=A).status_code == 422
    models = {m["id"]: m["available"] for m in client.get("/ai/models", headers=A).json()}
    assert models["openai/gpt-4o"] and models["anthropic/claude-sonnet-5-5"] and not models["gemini/gemini-2.0-flash"]


def test_pick_model():
    assert dispatcher.pick_model("auto", "price of AAPL?").startswith("anthropic/claude-haiku")
    assert dispatcher.pick_model("auto", "should I rebalance my portfolio?") == "anthropic/claude-sonnet-5-5"
    assert dispatcher.pick_model("openai/gpt-4o", "hi") == "openai/gpt-4o"


def _resp(content=None, calls=None):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=calls))])


def test_chat_tool_loop_and_byo_key(client, alice_account, monkeypatch):
    seen = []

    async def fake_completion(**kw):
        seen.append(kw)
        if len(seen) == 1:
            call = SimpleNamespace(id="c1", function=SimpleNamespace(name="get_portfolio", arguments="{}"), model_dump=lambda: {"id": "c1"})
            return _resp(calls=[call])
        tool_msg = kw["messages"][-1]
        assert tool_msg["role"] == "tool" and "AAPL" in tool_msg["content"]
        return _resp(content="You hold AAPL and MSFT.")

    monkeypatch.setattr(dispatcher, "_completion", fake_completion)
    r = client.post("/ai/chat", json={"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "what do I hold?"}]}, headers=A)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {"model": "openai/gpt-4o", "content": "You hold AAPL and MSFT.", "tools_used": ["get_portfolio"]}
    assert seen[0]["api_key"] == "sk-test-1234567890abcd"  # user's BYO key beats server key


def test_chat_falls_back(client, monkeypatch):
    async def flaky(**kw):
        if kw["model"].startswith("anthropic"):
            raise RuntimeError("overloaded")
        return _resp(content="ok from fallback")

    monkeypatch.setattr(dispatcher, "_completion", flaky)
    r = client.post("/ai/chat", json={"model": "anthropic/claude-sonnet-5-5", "messages": [{"role": "user", "content": "hi"}]}, headers=A)
    assert r.json()["model"] == "openai/gpt-4o-mini"


def test_chat_no_keys_502(client, monkeypatch):
    r = client.post("/ai/chat", json={"model": "gemini/gemini-2.0-flash", "messages": [{"role": "user", "content": "hi"}]}, headers=B)
    assert r.status_code == 502 and "no API key" in r.json()["detail"]


def test_mcp_requires_token_and_serves_tools(client, alice_account):
    hdr = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
    rpc = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_portfolio", "arguments": {}}}
    assert client.post("/mcp/", json=rpc, headers=hdr).status_code == 401

    token = client.post("/ai/mcp-tokens?label=claude", headers=A).json()["token"]
    h = {**hdr, "Authorization": f"Bearer {token}"}
    init = {
        "jsonrpc": "2.0", "id": 0, "method": "initialize",
        "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}},
    }
    assert client.post("/mcp/", json=init, headers=h).status_code == 200
    tools = client.post("/mcp/", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, headers=h).json()
    names = {t["name"] for t in tools["result"]["tools"]}
    assert {"get_portfolio", "get_targets_status", "get_quote"} <= names
    res = client.post("/mcp/", json=rpc, headers=h).json()
    assert "AAPL" in res["result"]["content"][0]["text"]
