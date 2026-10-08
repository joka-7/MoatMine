"""The agent's tools hold model-supplied arguments to the same bounds as the HTTP routes."""

import asyncio
import json
from pathlib import Path

import pytest

from app.ai.tools import TOOL_SPECS, run_tool, user_named
from app.db import SessionLocal
from app.jsontypes import JSONDict


def _run(name: str, args: JSONDict, user_said: str = "") -> JSONDict:
    with SessionLocal() as db:
        out: JSONDict = json.loads(asyncio.run(run_tool(name, args, db, "tool-user", user_said)))
    return out


@pytest.mark.parametrize(
    ("name", "args", "bad_field"),
    [
        ("get_valuation", {"symbol": "AAPL", "discount_rate": 0}, "discount_rate"),  # used to raise ZeroDivisionError
        ("get_valuation", {"symbol": "AAPL", "margin_of_safety": 150}, "margin_of_safety"),
        ("safety_check", {"symbol": "AAPL", "amount": -5000}, "amount"),  # used to pass the position check
        ("safety_check", {"symbol": "AAPL"}, "amount"),
    ],
)
def test_run_tool_rejects_out_of_bounds_arguments(client, name, args, bad_field):
    out = _run(name, args)
    assert out["error"] == "invalid arguments" and any(bad_field in d for d in out["details"])


def test_run_tool_applies_valid_overrides(client):
    out = _run("get_valuation", {"symbol": "AAPL", "discount_rate": 12, "margin_of_safety": 30})
    assert out["assumptions"]["discount_rate"] == 12 and out["assumptions"]["margin_of_safety"] == 30


@pytest.mark.parametrize(
    ("user_said", "allowed"),
    [
        ("please watch nvda for me", True),
        ("", False),  # MCP and other callers without a user message
        ("what's in the news today?", False),  # the model picked the symbol up from tool output
        ("look at NVDAX", False),
    ],
)
def test_run_tool_write_tools_need_the_user_to_name_the_symbol(client, user_said, allowed):
    out = _run("add_to_watchlist", {"symbol": "NVDA"}, user_said)
    assert ("error" not in out) is allowed


@pytest.mark.parametrize(
    ("symbol", "text", "named"),
    [
        ("AAPL", "buy aapl?", True),
        ("BRK.B", "and BRK.B", True),
        ("AAPL", "AAPLX", False),
        ("", "anything", False),
        # short tickers that are everyday words need capitals or a $: "is it a good time" names nothing
        ("IT", "is it a good time to buy?", False),
        ("A", "is it a good time to buy?", False),
        ("ON", "carry on", False),
        ("IT", "watch IT for me", True),
        ("IT", "watch $it for me", True),
        ("ALL", "add ALL", True),
    ],
)
def test_user_named(symbol, text, named):
    assert user_named(symbol, text) is named


def test_tool_specs_match_the_readme():
    readme = (Path(__file__).resolve().parents[2] / "README.md").read_text()
    missing = [s["name"] for s in TOOL_SPECS if f"`{s['name']}`" not in readme]
    assert not missing, f"README's AI agent row doesn't list {missing}"


def test_run_tool_write_gate_ignores_the_case_the_model_sends(client):
    # "it" from the model must not match the word "it" in the user's sentence
    assert "error" in _run("save_note", {"symbol": "it", "title": "t", "body": "b"}, "is it a good time to buy?")
