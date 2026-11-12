"""Every sentence the API sends that a person reads must have a Hebrew translation in
web/src/lib/i18n/serverText.he.json, or the Hebrew screens show English."""

import asyncio
import json
import re
from pathlib import Path
from typing import Any

import pytest

from tests.conftest import auth
from tests.server_text import SPEC, translate

U = auth("server-text-user")

# abbreviations and symbols that read the same in both languages
_NEUTRAL = {"pass", "warn", "block", "EPS", "BVPS", "EBITDA", "FCF", "ROA", "ROIC", "CAGR", "D1", "DDM", "DCF", "pp", "F", "Z", "P", "E", "EV", "S", "SPY"}


def _is_language_neutral(text: str) -> bool:
    words = re.findall(r"[A-Za-z][A-Za-z']*", text)
    return all(w in _NEUTRAL or len(w) < 3 for w in words)


def _walk(value: Any, key: str = "") -> list[tuple[str, str]]:
    """Every string in a JSON value, with the key it sits under."""
    if isinstance(value, str):
        return [(key, value)]
    if isinstance(value, list):
        return [pair for item in value for pair in _walk(item, key)]
    if isinstance(value, dict):
        return [pair for k, v in value.items() for pair in _walk(v, k)]
    return []


# keys whose values are sentences meant for a person (the rest are symbols, ids, dates, enums, URLs)
_TEXT_KEYS = {"growth_source", "message", "name", "note", "formula", "skipped", "verdict", "summary", "label", "description", "disclaimer",
              "basis", "strengths", "weaknesses", "missing", "comment", "overview", "fit", "improve"}
# values under those keys that are the user's own or another provider's text, not ours
_NOT_OURS = {"symbol", "company", "headline", "title", "body", "url"}


def _texts(payload: Any) -> set[str]:
    return {s for k, s in _walk(payload) if k in _TEXT_KEYS and k not in _NOT_OURS and s.strip()}


def _untranslated(texts: set[str]) -> list[str]:
    return sorted(t for t in texts if translate(t) == t and not _is_language_neutral(t))


@pytest.fixture(scope="module")
def seeded(client: Any) -> None:
    acc = client.post("/accounts", json={"name": "Real", "cash": 1000}, headers=U).json()["id"]
    client.post("/holdings", json={"account_id": acc, "symbol": "AAPL", "quantity": 5, "avg_cost": 150}, headers=U)
    client.put("/safety/profile", json={"level": "conservative", "paper_mode": False}, headers=U)


def test_sentences_in_the_stock_endpoints_are_translated(client: Any, seeded: None) -> None:
    payloads = [client.get(f"/stocks/{s}/{path}", headers=U).json()
                for s in ("AAPL", "TSLA", "JNJ") for path in ("safety", "valuation", "crises")]
    assert _untranslated(set().union(*(_texts(p) for p in payloads))) == []


def test_sentences_in_the_portfolio_endpoints_are_translated(client: Any, seeded: None) -> None:
    payloads = [client.get("/safety/portfolio", headers=U).json(), client.get("/safety/stress", headers=U).json(),
                client.post("/safety/check", json={"symbol": "TSLA", "amount": 100000}, headers=U).json(),
                client.post("/safety/check", json={"symbol": "AAPL", "amount": 10}, headers=U).json()]
    assert _untranslated(set().union(*(_texts(p) for p in payloads))) == []


def test_alert_and_target_sentences_are_translated(client: Any, seeded: None) -> None:
    from app.worker import run_once

    client.post("/targets", json={"name": "Guard", "amount_max": 1.0, "profit_min": 500.0, "period_min_days": 9999, "risk_max": 0.1}, headers=U)
    client.post("/watchlist", json={"symbol": "MSFT", "alert_above": 1.0}, headers=U)
    client.post("/watchlist", json={"symbol": "NVDA", "alert_below": 1_000_000.0}, headers=U)
    asyncio.run(run_once())
    alerts = client.get("/alerts", headers=U).json()
    assert alerts, "the worker should have raised alerts for these targets and thresholds"
    notes = [{"note": t["intent_note"]} for t in client.get("/targets", headers=U).json()]  # a target's name is the user's own
    assert _untranslated(_texts(alerts) | _texts(notes)) == []


def test_every_scenario_name_and_note_of_the_stress_test_is_translated(client: Any, seeded: None) -> None:
    stress = client.get("/safety/stress", headers=U).json()
    names = {s["name"] for s in stress["scenarios"]} | {w["basis"] for s in stress["scenarios"] for w in s["worst"]} | {stress["note"]}
    assert _untranslated(names) == []


def test_the_sentences_the_routes_raise_are_translated() -> None:
    import ast

    source = (Path(__file__).parent.parent / "app" / "routers" / "safety.py").read_text()
    raised = {n.args[1].value for n in ast.walk(ast.parse(source))
              if isinstance(n, ast.Call) and getattr(n.func, "id", "") == "HTTPException" and len(n.args) > 1
              and isinstance(n.args[1], ast.Constant) and isinstance(n.args[1].value, str)}
    assert raised, "expected to find HTTPException messages"
    assert _untranslated(raised) == []


def test_python_matcher_agrees_with_the_pinned_cases() -> None:
    cases = json.loads((Path(__file__).parent / "vectors" / "server_text.json").read_text())["cases"]
    assert [(c["en"], translate(c["en"])) for c in cases] == [(c["en"], c["he"]) for c in cases]


def test_the_table_has_no_entry_translated_to_itself() -> None:
    same = [en for en, he in SPEC["exact"].items() if en == he]
    assert same == []
