from types import SimpleNamespace

from app import research
from app.ai import dispatcher
from tests.conftest import auth

C = auth("carol")


def test_company_merges_profile_and_company(client):
    d = client.get("/stocks/aapl/company").json()
    assert d["name"] == "Apple Inc." and d["description"] and d["employees"] > 0 and d["market_cap"]


def test_earnings_analysts_dividends(client):
    e = client.get("/stocks/AAPL/earnings").json()
    assert len(e) == 8 and {"period", "actual", "estimate", "surprise_pct"} <= e[0].keys()
    a = client.get("/stocks/AAPL/analysts").json()
    assert a["recommendations"][0]["buy"] >= 0
    assert a["price_target"]["low"] < a["price_target"]["mean"] < a["price_target"]["high"]
    assert "upside_pct" in a["price_target"]
    d = client.get("/stocks/AAPL/dividends").json()
    assert d["splits"] == [{"date": "2020-08-31", "ratio": "4:1"}]


def test_valuation_endpoint_and_overrides(client):
    v = client.get("/stocks/MSFT/valuation").json()
    assert v["symbol"] == "MSFT" and v["price"] > 0
    assert {m["key"] for m in v["models"]} == {"dcf", "graham_number", "graham_formula", "lynch", "ddm", "epv", "pe_multiple", "ev_ebitda"}
    assert v["summary"]["models_used"] >= 5 and v["summary"]["verdict"]
    assert v["quality"]["piotroski"]["score"] is not None and v["quality"]["altman_z"]["zone"]
    low = client.get("/stocks/MSFT/valuation?discount_rate=12&growth_rate=2").json()
    dcf = lambda r: next(m for m in r["models"] if m["key"] == "dcf")["value"]  # noqa: E731
    assert dcf(low) < dcf(v)
    assert low["assumptions"]["growth_source"] == "user"
    assert client.get("/stocks/MSFT/valuation?discount_rate=0").status_code == 422


def test_news_feed_covers_holdings_and_watchlist(client):
    acc = client.post("/accounts", json={"name": "x"}, headers=C).json()["id"]
    client.post("/holdings", json={"account_id": acc, "symbol": "NVDA", "quantity": 1, "avg_cost": 1}, headers=C)
    client.post("/watchlist", json={"symbol": "GOOGL"}, headers=C)
    feed = client.get("/news/feed", headers=C).json()
    syms = {n["symbol"] for n in feed}
    assert syms == {"NVDA", "GOOGL"}
    assert all(n["held"] == (n["symbol"] == "NVDA") for n in feed)
    assert [n["datetime"] for n in feed] == sorted((n["datetime"] for n in feed), reverse=True)


def test_news_summary_parses_and_caches(client, monkeypatch):
    calls = []

    async def fake(**kw):
        calls.append(kw)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
            content='Here you go: {"summary": "Mixed week.", "sentiment": "Bullish", "points": ["a", "b"], "watch": "earnings"}'
        ))])

    monkeypatch.setattr(dispatcher, "_completion", fake)
    research._cache.clear()
    r = client.get("/stocks/TSLA/news/summary?days=7", headers=C)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["sentiment"] == "bullish" and d["points"] == ["a", "b"] and d["count"] == 5
    assert calls[0]["model"].startswith("anthropic/claude-haiku") and "tools" not in calls[0]
    assert client.get("/stocks/TSLA/news/summary?days=7", headers=C).json()["cached"] is True
    assert len(calls) == 1


def test_parse_json_fallback():
    assert research._parse_json("plain text")["summary"] == "plain text"
    assert research._parse_json('{"sentiment": "euphoric"}')["sentiment"] == "unknown"


def test_valuation_tool_for_agent(client):
    import asyncio
    import json

    from app.ai.tools import run_tool
    from app.db import SessionLocal

    with SessionLocal() as db:
        out = json.loads(asyncio.run(run_tool("get_valuation", {"symbol": "aapl", "discount_rate": 10}, db, "carol")))
    assert out["assumptions"]["discount_rate"] == 10 and out["summary"]["fair_value"]
