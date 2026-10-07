"""Portfolio risk maths and stress scenarios. Pure functions over aligned close series."""

import math
from statistics import mean, pstdev

TRADING_DAYS = 252
Z95 = 1.645


def daily_returns(closes: list[float]) -> list[float]:
    return [b / a - 1 for a, b in zip(closes, closes[1:]) if a]


def align(series: dict[str, list[tuple[int, float]]]) -> tuple[list[int], dict[str, list[float]]]:
    """Keep only the days every series has (by UTC day), returning closes in date order."""
    by_day = {s: {t - t % 86400: c for t, c in pts} for s, pts in series.items() if pts}
    if not by_day:
        return [], {}
    days = sorted(set.intersection(*(set(d) for d in by_day.values())))
    return days, {s: [d[t] for t in days] for s, d in by_day.items()}


def beta(asset: list[float], bench: list[float]) -> float | None:
    if len(asset) != len(bench) or len(asset) < 20:
        return None
    ma, mb = mean(asset), mean(bench)
    var_b = sum((b - mb) ** 2 for b in bench)
    if not var_b:
        return None
    return sum((a - ma) * (b - mb) for a, b in zip(asset, bench)) / var_b


def correlation(x: list[float], y: list[float]) -> float | None:
    if len(x) != len(y) or len(x) < 20:
        return None
    sx, sy = pstdev(x), pstdev(y)
    if not sx or not sy:
        return None
    mx, my = mean(x), mean(y)
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / len(x) / (sx * sy)


def max_drawdown(index: list[float]) -> float | None:
    if not index:
        return None
    peak, worst = index[0], 0.0
    for v in index:
        peak = max(peak, v)
        worst = min(worst, v / peak - 1)
    return round(worst * 100, 2)


def portfolio_risk(values: dict[str, float], cash: float, closes: dict[str, list[float]],
                   bench: list[float] | None, sectors: dict[str, str | None]) -> dict:
    """Risk of the current holdings, as if held through the price history given.

    `closes` must already be aligned (same days, same order) including the benchmark if given.
    """
    invested = sum(values.values())
    total = invested + cash
    weights = {s: v / invested for s, v in values.items()} if invested else {}
    rets = {s: daily_returns(closes[s]) for s in weights if s in closes}
    n = min((len(r) for r in rets.values()), default=0)

    port = [sum(weights[s] * rets[s][i] for s in rets) * (invested / total if total else 0) for i in range(n)]
    sd = pstdev(port) if len(port) > 1 else None
    bench_rets = daily_returns(bench)[:n] if bench else None

    index, level = [], 1.0
    for r in port:
        level *= 1 + r
        index.append(level)

    # concentration
    hhi = sum(w * w for w in weights.values())
    sector_pct: dict[str, float] = {}
    for s, v in values.items():
        key = sectors.get(s) or "Unknown"
        sector_pct[key] = sector_pct.get(key, 0) + (v / total * 100 if total else 0)

    top = sorted(values, key=values.get, reverse=True)[:10]
    corr = [[(round(c, 2) if (c := correlation(rets[a], rets[b])) is not None else None) if a in rets and b in rets else None
             for b in top] for a in top]
    off_diag = [corr[i][j] for i in range(len(top)) for j in range(len(top)) if i < j and corr[i][j] is not None]

    return {
        "total_value": round(total, 2),
        "invested_value": round(invested, 2),
        "cash_pct": round(cash / total * 100, 2) if total else 0.0,
        "days": n,
        "volatility_pct": round(sd * math.sqrt(TRADING_DAYS) * 100, 2) if sd is not None else None,
        "beta": round(b, 2) if bench_rets and (b := beta(port, bench_rets)) is not None else None,
        "var95_1d": round(Z95 * sd * total, 2) if sd is not None else None,
        "var95_1m": round(Z95 * sd * math.sqrt(21) * total, 2) if sd is not None else None,
        "max_drawdown_pct": max_drawdown(index),
        "top_position_pct": round(max(values.values()) / total * 100, 2) if values and total else None,
        "effective_holdings": round(1 / hhi, 1) if hhi else None,
        "holdings_count": len(values),
        "sectors": dict(sorted(((k, round(v, 2)) for k, v in sector_pct.items()), key=lambda kv: -kv[1])),
        "correlation": {"symbols": top, "matrix": corr},
        "avg_correlation": round(mean(off_diag), 2) if off_diag else None,
    }


def stress_scenarios(values: dict[str, float], cash: float, betas: dict[str, float | None],
                     crisis_drawdowns: dict[str, dict[str, float | None]],
                     benchmark_crisis: dict[str, float | None], crises: list[tuple[str, str]],
                     shocks: tuple[float, ...] = (-10.0, -20.0, -35.0)) -> list[dict]:
    """Loss of today's portfolio under each scenario.

    Historical crises use each holding's own fall in that crisis; if it wasn't listed yet, its beta
    times the benchmark's fall (beta defaults to 1). Market shocks use beta times the shock.
    Losses are capped at -100% per holding; cash is assumed flat.
    """
    total = sum(values.values()) + cash

    def run(key: str, name: str, kind: str, per_symbol: dict[str, tuple[float, str]]) -> dict:
        contribs = []
        for s, v in values.items():
            pct, basis = per_symbol[s]
            pct = max(-100.0, pct)
            contribs.append({"symbol": s, "change_pct": round(pct, 1), "change": round(v * pct / 100, 2), "basis": basis})
        loss = sum(c["change"] for c in contribs)
        return {
            "key": key, "name": name, "kind": kind,
            "change": round(loss, 2),
            "change_pct": round(loss / total * 100, 2) if total else 0.0,
            "worst": sorted(contribs, key=lambda c: c["change"])[:3],
            "holdings": contribs,
        }

    out = []
    for key, name in crises:
        bench_dd = benchmark_crisis.get(key)
        per = {}
        for s in values:
            own = crisis_drawdowns.get(s, {}).get(key)
            if own is not None:
                per[s] = (own, "actual fall")
            else:
                b = betas.get(s)
                per[s] = ((b if b is not None else 1.0) * (bench_dd or 0.0), "estimated from beta")
        out.append(run(key, name, "historical", per))
    for shock in shocks:
        per = {s: ((betas.get(s) if betas.get(s) is not None else 1.0) * shock, "beta × market") for s in values}
        out.append(run(f"market{int(shock)}", f"Market falls {abs(shock):g}%", "hypothetical", per))
    return out
