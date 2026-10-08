"""PAPI evaluation never turns a missing price into a plausible-looking number."""

from datetime import UTC, datetime

import pytest

from app.models import Target
from app.targets import evaluate

NOW = datetime(2026, 3, 2, 12, tzinfo=UTC)  # 60.5 days after the holding opened


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
    out = evaluate(t, _snapshot(stale), {}, NOW)
    assert out["checks"]["profit"]["value"] == profit and out["checks"]["profit"]["status"] == status
    assert out["unpriced"] == (["AAA"] if stale else [])


@pytest.mark.parametrize(
    ("now", "days", "status"),
    [
        (NOW, 60, "ok"),
        (datetime(2026, 1, 15, tzinfo=UTC), 14, "below_min"),  # held two weeks of a 30-day minimum
        (datetime(2026, 1, 31, tzinfo=UTC), 30, "ok"),  # exactly at the minimum
        (datetime(2026, 12, 31, tzinfo=UTC), 364, "above_max"),
    ],
)
def test_evaluate_measures_the_period_with_the_given_clock(now, days, status):
    t = Target(id=1, name="t", symbol="AAA", period_min_days=30, period_max_days=180, intent="growth", intent_note="")
    period = evaluate(t, _snapshot(False), {}, now)["checks"]["period"]
    assert period["value"] == days and period["status"] == status
