"""Portfolio and target maths against the vectors shared with the TypeScript port (`web/src/lib/calc/`)."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from app.analytics import annual_volatility_pct
from app.models import Account, Holding, Target
from app.portfolio import build_snapshot
from app.safety.check import Book, Candidate, Rules, check_buy, loss_limit_breach, portfolio_breaches
from app.safety.profile import DEFAULT_RULES, level_from_answers
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


def _book(b: dict[str, Any]) -> Book:
    return Book(total_value=b["total_value"], by_symbol=b["by_symbol"], by_sector=b["by_sector"], cash=b["cash"], unpriced=tuple(b["unpriced"]))


@pytest.mark.parametrize("case", VECTORS["checkBuy"], ids=lambda c: c["name"])
def test_check_buy(case: dict[str, Any]) -> None:
    assert check_buy(Rules(**case["rules"]), Candidate(**case["candidate"]), _book(case["book"])) == case["expect"]


@pytest.mark.parametrize("case", VECTORS["portfolioBreaches"], ids=lambda c: c["name"])
def test_portfolio_breaches(case: dict[str, Any]) -> None:
    out = [{"rule": b.rule, "subject": b.subject, "pct": b.pct, "limit": b.limit, "message": b.message} for b in portfolio_breaches(Rules(**case["rules"]), _book(case["book"]))]
    assert out == case["expect"]


@pytest.mark.parametrize("case", VECTORS["lossLimit"], ids=lambda c: c["name"])
def test_loss_limit_breach(case: dict[str, Any]) -> None:
    b = loss_limit_breach(Rules(**case["rules"]), case["values"])
    out = None if b is None else {"rule": b.rule, "subject": b.subject, "pct": b.pct, "limit": b.limit, "message": b.message}
    assert out == case["expect"]


@pytest.mark.parametrize("case", VECTORS["levelFromAnswers"], ids=lambda c: c["name"])
def test_level_from_answers(case: dict[str, Any]) -> None:
    assert level_from_answers(case["answers"]) == case["expect"]


@pytest.mark.parametrize("case", VECTORS["levelFromAnswersErrors"], ids=lambda c: c["name"])
def test_level_from_answers_rejects_bad_input(case: dict[str, Any]) -> None:
    with pytest.raises(ValueError, match=case["expect"]):
        level_from_answers(case["answers"])


def test_default_rules_match() -> None:
    assert DEFAULT_RULES == VECTORS["defaultRules"]
