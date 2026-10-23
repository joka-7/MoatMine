"""Portfolio and target maths against the vectors shared with the TypeScript port (`web/src/lib/calc/`)."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from app.analytics import annual_volatility_pct
from app.models import Account, Holding, Target
from app.portfolio import build_snapshot
from app.targets import check_bound, evaluate

VECTORS: dict[str, Any] = json.loads((Path(__file__).parent / "vectors" / "calc.json").read_text())
SNAPSHOTS: dict[str, dict[str, Any]] = {c["name"]: c for c in VECTORS["snapshot"]}


@pytest.mark.parametrize("case", VECTORS["checkBound"], ids=lambda c: c["name"])
def test_check_bound(case: dict[str, Any]) -> None:
    assert check_bound(case["value"], case["target"], case["min"], case["max"]) == case["expect"]


@pytest.mark.parametrize("case", VECTORS["snapshot"], ids=lambda c: c["name"])
def test_build_snapshot(case: dict[str, Any]) -> None:
    accounts = [Account(**a) for a in case["accounts"]]
    holdings = [Holding(**{**h, "opened_at": datetime.fromisoformat(h["opened_at"])}) for h in case["holdings"]]
    assert build_snapshot(case["mode"], accounts, holdings, case["quotes"]) == case["expect"]


@pytest.mark.parametrize("case", VECTORS["evaluate"], ids=lambda c: c["name"])
def test_evaluate_target(case: dict[str, Any]) -> None:
    out = evaluate(Target(**case["target"]), SNAPSHOTS[case["snapshot"]]["expect"], case["risks"], datetime.fromisoformat(case["now"]))
    assert out == case["expect"]


@pytest.mark.parametrize("case", VECTORS["volatility"], ids=lambda c: c["name"])
def test_annual_volatility(case: dict[str, Any]) -> None:
    assert annual_volatility_pct(case["closes"]) == case["expect"]
