"""The agent's tools hold model-supplied arguments to the same bounds as the HTTP routes."""

import asyncio
import json

import pytest

from app.ai.tools import run_tool, user_named
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
    [("AAPL", "buy aapl?", True), ("BRK.B", "and BRK.B", True), ("AAPL", "AAPLX", False), ("", "anything", False)],
)
def test_user_named(symbol, text, named):
    assert user_named(symbol, text) is named
