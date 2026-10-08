"""PAPI evaluation never turns a missing price into a plausible-looking number."""

import pytest

from app.models import Target
from app.targets import evaluate


def _snapshot(stale: bool) -> dict[str, object]:
    row = {"symbol": "AAA", "cost": 1_000.0, "value": 1_000.0 if stale else 600.0, "opened_at": "2026-01-01T00:00:00+00:00", "stale": stale}
    return {
        "holdings": [row],
        "totals": {"cost": 1_000.0, "pnl_pct": 0.0 if stale else -40.0, "net_worth": row["value"], "unpriced": ["AAA"] if stale else []},
    }


@pytest.mark.parametrize("symbol", ["AAA", None])
@pytest.mark.parametrize(("stale", "profit", "status"), [(False, -40.0, "below_min"), (True, None, "no_data")])
def test_evaluate_reports_no_data_for_unpriced_holdings(symbol, stale, profit, status):
    t = Target(id=1, name="t", symbol=symbol, profit_min=-20.0, intent="growth", intent_note="")
    out = evaluate(t, _snapshot(stale), {})
    assert out["checks"]["profit"]["value"] == profit and out["checks"]["profit"]["status"] == status
    assert out["unpriced"] == (["AAA"] if stale else [])
