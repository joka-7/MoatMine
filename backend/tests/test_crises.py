from collections.abc import Sequence

from app import crises as c
from app.market.base import Candle

W = 7 * 86400


def bars_from(start: str, closes: Sequence[float]) -> list[Candle]:
    t0 = c._ts(start)
    return [{"t": t0 + i * W, "o": x, "h": x, "l": x, "c": x, "v": 0} for i, x in enumerate(closes)]


def test_crisis_stats_drawdown_and_recovery():
    # starts at 100, falls to 60 inside the window, recovers to 100 four weeks after the trough
    closes = [100, 90, 70, 60, 65, 80, 95, 100, 110]
    bars = bars_from("2020-02-19", closes)
    s = c.crisis_stats(bars, "2020-02-19", "2020-03-23")  # window covers the first ~6 bars
    assert s is not None
    assert s["drawdown_pct"] == -40.0 and s["start_price"] == 100
    assert s["recovered"] and s["recovery_days"] == 7 * 7
    assert s["still_below_pct"] is None


def test_crisis_stats_not_recovered_and_not_listed():
    bars = bars_from("2022-01-03", [100, 80, 70, 75, 72] + [74] * 40)
    s = c.crisis_stats(bars, "2022-01-03", "2022-10-12")
    assert s is not None
    assert not s["recovered"] and s["still_below_pct"] == -26.0
    assert c.crisis_stats(bars, "2007-10-09", "2009-03-09") is None  # listed later


def test_worst_drawdowns_episodes():
    closes = [100, 80, 100, 120, 60, 90, 130, 117]
    dd = c.worst_drawdowns(bars_from("2010-01-01", closes), n=5, min_depth=5)
    assert [d["depth_pct"] for d in dd] == [-50.0, -20.0, -10.0]
    assert dd[0]["recovered"] and dd[0]["recovery_days"] == 2 * 7
    assert dd[2]["recovered"] is False  # 130 -> 117 still open


def test_endpoint_shape(client):
    r = client.get("/stocks/aapl/crises").json()
    assert r["symbol"] == "AAPL" and r["benchmark"] == "SPY"
    assert [x["key"] for x in r["crises"]] == [k for k, *_ in c.CRISES]
    assert all(x["benchmark"] for x in r["crises"])
    assert r["resilience"]["crises_covered"] == 6 and r["resilience"]["label"]
    assert r["worst_drawdowns"] and all(d["depth_pct"] <= -10 for d in r["worst_drawdowns"])
