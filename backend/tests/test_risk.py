"""Portfolio risk maths at the boundaries, with numbers you can check by hand."""

import pytest

from app.safety import risk


@pytest.mark.parametrize(("asset", "bench", "expected"), [
    ([0.01] * 10 + [-0.01] * 10, [0.005] * 10 + [-0.005] * 10, 2.0),  # moves twice the benchmark
    ([0.01] * 19, [0.005] * 19, None),  # under 20 days: too short to say
    ([0.01] * 20, [0.005] * 20, None),  # flat benchmark: no variance to divide by
    ([0.01] * 20, [0.005] * 21, None),  # misaligned series
])
def test_beta(asset, bench, expected):
    got = risk.beta(asset, bench)
    assert got == (pytest.approx(expected) if expected is not None else None)


@pytest.mark.parametrize(("x", "y", "expected"), [
    ([1.0, 2.0] * 10, [2.0, 4.0] * 10, 1.0),
    ([1.0, 2.0] * 10, [4.0, 2.0] * 10, -1.0),
    ([1.0] * 20, [1.0, 2.0] * 10, None),  # a constant series has no correlation
    ([1.0, 2.0] * 5, [2.0, 4.0] * 5, None),  # under 20 days
])
def test_correlation(x, y, expected):
    got = risk.correlation(x, y)
    assert got == (pytest.approx(expected) if expected is not None else None)


@pytest.mark.parametrize(("values", "cash", "expected"), [
    # +10% then -10%: daily sd 10%; VaR 1.645 x 10% x 1,000; worst fall 110 -> 99
    ({"A": 1_000}, 0, {"volatility_pct": 158.75, "var95_1d": 164.5, "max_drawdown_pct": -10.0, "cash_pct": 0.0,
                      "effective_holdings": 1.0, "top_position_pct": 100.0}),
    # half in cash halves the swings
    ({"A": 500}, 500, {"volatility_pct": 79.37, "var95_1d": 82.25, "max_drawdown_pct": -5.0, "cash_pct": 50.0}),
    # nothing held: every measure is unknown, not zero
    ({}, 0, {"volatility_pct": None, "var95_1d": None, "max_drawdown_pct": None, "effective_holdings": None,
             "top_position_pct": None, "days": 0}),
])
def test_portfolio_risk(values, cash, expected):
    got = risk.portfolio_risk(values, cash, {"A": [100, 110, 99]}, None, {})
    assert {k: got[k] for k in expected} == expected


@pytest.mark.parametrize(("beta", "own_fall", "shock", "change_pct", "basis"), [
    (1.5, None, -20.0, -30.0, "beta × market"),
    (3.0, None, -50.0, -100.0, "beta × market"),  # a holding can't lose more than all of it
    (None, None, -20.0, -20.0, "beta × market"),  # no beta: moves with the market
])
def test_stress_scenarios_market_shocks(beta, own_fall, shock, change_pct, basis):
    out = risk.stress_scenarios({"A": 1_000}, 1_000, {"A": beta}, {}, {}, [], shocks=(shock,))
    holding = out[0]["holdings"][0]
    assert holding["change_pct"] == change_pct and holding["basis"] == basis
    assert out[0]["change_pct"] == round(change_pct * 1_000 / 2_000, 2)  # cash is assumed flat


@pytest.mark.parametrize(("own", "bench", "change_pct", "basis"), [
    (-40.0, -50.0, -40.0, "actual fall"),  # listed then: its own fall
    (None, -50.0, -100.0, "estimated from beta"),  # not listed: beta 2 x benchmark, capped
])
def test_stress_scenarios_historical(own, bench, change_pct, basis):
    crisis = {"A": {"gfc": own}} if own is not None else {}
    out = risk.stress_scenarios({"A": 1_000}, 0, {"A": 2.0}, crisis, {"gfc": bench}, [("gfc", "2008")], shocks=())
    assert (out[0]["holdings"][0]["change_pct"], out[0]["holdings"][0]["basis"]) == (change_pct, basis)
