"""How a stock behaved in bad times.

1. Known market crises: drawdown inside the crisis window, return over the window, how long it
   took to get back to the pre-crisis price, and the same numbers for a benchmark (SPY).
2. The stock's own worst drawdowns over its whole history, with recovery time.

Uses weekly closes, so depths are slightly shallower than intraday/daily lows.
"""

import asyncio
import time
from datetime import date, datetime, timezone

from app.market.base import Candle, MarketProvider

CRISES = [
    # key, name, start (market peak), end (market trough), short description
    ("dotcom", "Dot-com crash", "2000-03-24", "2002-10-09", "Tech bubble burst; S&P 500 fell ~49%."),
    ("gfc", "Global financial crisis", "2007-10-09", "2009-03-09", "Housing and banking collapse; S&P 500 fell ~57%."),
    ("2011", "2011 debt-ceiling & euro crisis", "2011-04-29", "2011-10-03", "US downgrade and euro debt fears; ~19% fall."),
    ("2018q4", "Q4 2018 sell-off", "2018-09-20", "2018-12-24", "Rate hikes and trade war; ~20% fall."),
    ("covid", "COVID crash", "2020-02-19", "2020-03-23", "Fastest bear market on record; ~34% fall in a month."),
    ("2022", "2022 rate-hike bear market", "2022-01-03", "2022-10-12", "Inflation and rapid rate hikes; ~25% fall."),
]

HISTORY_START = "1999-01-01"


def _ts(d: str) -> int:
    return int(datetime.fromisoformat(d).replace(tzinfo=timezone.utc).timestamp())


def _day(t: int) -> str:
    return datetime.fromtimestamp(t, timezone.utc).date().isoformat()


def crisis_stats(bars: list[Candle], start: str, end: str) -> dict | None:
    """Metrics for one window, or None if the stock didn't trade through it."""
    s, e = _ts(start), _ts(end)
    window = [b for b in bars if s <= b["t"] <= e + 7 * 86400]
    if len(window) < 2 or bars[0]["t"] > s + 14 * 86400:
        return None  # listed after the crisis started
    base = window[0]["c"]
    trough = min(window, key=lambda b: b["c"])
    rec = next((b for b in bars if b["t"] > trough["t"] and b["c"] >= base), None)
    last = bars[-1]["c"]
    return {
        "start_price": round(base, 2),
        "drawdown_pct": round((trough["c"] / base - 1) * 100, 1),
        "trough_date": _day(trough["t"]),
        "window_return_pct": round((window[-1]["c"] / base - 1) * 100, 1),
        "recovered": rec is not None,
        "recovery_date": _day(rec["t"]) if rec else None,
        "recovery_days": (rec["t"] - window[0]["t"]) // 86400 if rec else None,
        "still_below_pct": None if rec else round((last / base - 1) * 100, 1),
    }


def worst_drawdowns(bars: list[Candle], n: int = 5, min_depth: float = 10.0) -> list[dict]:
    """Largest non-overlapping peak-to-trough falls of at least `min_depth`%."""
    if len(bars) < 2:
        return []
    episodes, peak, trough = [], bars[0], None
    for b in bars[1:]:
        if b["c"] >= peak["c"]:
            if trough:  # back at the old high: episode closed
                episodes.append((peak, trough, b))
                trough = None
            peak = b
        elif trough is None or b["c"] < trough["c"]:
            trough = b
    if trough:  # still under water
        episodes.append((peak, trough, None))
    out = []
    for p, t, r in episodes:
        depth = (t["c"] / p["c"] - 1) * 100
        if -depth < min_depth:
            continue
        out.append({
            "peak_date": _day(p["t"]),
            "trough_date": _day(t["t"]),
            "depth_pct": round(depth, 1),
            "fall_days": (t["t"] - p["t"]) // 86400,
            "recovery_date": _day(r["t"]) if r else None,
            "recovery_days": (r["t"] - t["t"]) // 86400 if r else None,
            "recovered": r is not None,
        })
    return sorted(out, key=lambda x: x["depth_pct"])[:n]


def _resilience(rows: list[dict]) -> dict:
    pairs = [(r["stock"]["drawdown_pct"], r["benchmark"]["drawdown_pct"]) for r in rows if r["stock"] and r["benchmark"]]
    if not pairs:
        return {"downside_capture_pct": None, "label": "not enough history", "crises_covered": 0}
    s = sum(p[0] for p in pairs) / len(pairs)
    m = sum(p[1] for p in pairs) / len(pairs)
    capture = round(s / m * 100) if m else None
    if capture is None:
        label = "n/a"
    elif capture <= 80:
        label = "fell less than the market"
    elif capture <= 120:
        label = "fell about as much as the market"
    else:
        label = "fell more than the market"
    recovered = sum(1 for r in rows if r["stock"] and r["stock"]["recovered"])
    return {
        "downside_capture_pct": capture,
        "label": label,
        "crises_covered": len(pairs),
        "recovered_count": recovered,
        "avg_drawdown_pct": round(s, 1),
        "avg_benchmark_drawdown_pct": round(m, 1),
    }


async def bad_times(provider: MarketProvider, symbol: str, benchmark: str = "SPY") -> dict:
    end = int(time.time())
    start = _ts(HISTORY_START)
    stock_bars, bench_bars = await asyncio.gather(
        provider.candles(symbol, "W", start, end),
        provider.candles(benchmark, "W", start, end) if benchmark != symbol else asyncio.sleep(0, result=None),
    )
    if bench_bars is None:
        bench_bars = stock_bars
    rows = []
    for key, name, s, e, desc in CRISES:
        rows.append({
            "key": key, "name": name, "start": s, "end": e, "description": desc,
            "stock": crisis_stats(stock_bars, s, e) if stock_bars else None,
            "benchmark": crisis_stats(bench_bars, s, e) if bench_bars else None,
        })
    first = _day(stock_bars[0]["t"]) if stock_bars else None
    return {
        "symbol": symbol,
        "benchmark": benchmark,
        "history_from": first,
        "crises": rows,
        "resilience": _resilience(rows),
        "worst_drawdowns": worst_drawdowns(stock_bars),
        "data_source": "mock-fallback" if getattr(provider, "candles_fell_back", False) else provider.name,
        "note": "Weekly closes. Past behaviour in crises does not predict future behaviour.",
        "as_of": date.today().isoformat(),
    }
