"""The agent's tools hold model-supplied arguments to the same bounds as the HTTP routes."""

import asyncio
import json

import pytest

from app.ai.tools import run_tool
from app.db import SessionLocal
from app.jsontypes import JSONDict


def _run(name: str, args: JSONDict) -> JSONDict:
    with SessionLocal() as db:
        out: JSONDict = json.loads(asyncio.run(run_tool(name, args, db, "tool-user")))
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
