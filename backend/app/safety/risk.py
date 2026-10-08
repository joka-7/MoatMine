"""Portfolio risk maths and stress scenarios. Pure functions over aligned close series."""

import math
from itertools import pairwise
from statistics import mean, pstdev

from app.jsontypes import JSONDict

TRADING_DAYS = 252
Z95 = 1.645


def daily_returns(closes: list[float]) -> list[float]:
    return [b / a - 1 for a, b in pairwise(closes) if a]


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
    return sum((a - ma) * (b - mb) for a, b in zip(asset, bench, strict=True)) / var_b


def correlation(x: list[float], y: list[float]) -> float | None:
    if len(x) != len(y) or len(x) < 20:
        return None
    sx, sy = pstdev(x), pstdev(y)
    if not sx or not sy:
        return None
    mx, my = mean(x), mean(y)
    return sum((a - mx) * (b - my) for a, b in zip(x, y, strict=True)) / len(x) / (sx * sy)


def max_drawdown(index: list[float]) -> float | None:
    if not index:
        return None
    peak, worst = index[0], 0.0
    for v in index:
        peak = max(peak, v)
        worst = min(worst, v / peak - 1)
    return round(worst * 100, 2)


def portfolio_risk(values: dict[str, float], cash: float, closes: dict[str, list[float]],
                   bench: list[float] | None, sectors: dict[str, str | None]) -> JSONDict:
    """Risk of the current holdings, as if held through the price history given.

    `closes` must already be aligned (same days, same order) including the benchmark if given.
    Holdings with no price history are assumed to move like the ones that have it (weights are
    renormalised over the covered holdings) rather than like cash, which would understate risk;
    `uncovered_pct` says how much of the invested value that assumption covers.
    """
    invested = sum(values.values())
    total = invested + cash
    weights = {s: v / invested for s, v in values.items()} if invested else {}
    rets = {s: daily_returns(closes[s]) for s in weights if s in closes}
    n = min((len(r) for r in rets.values()), default=0)
    covered = sum(weights[s] for s in rets)
    invested_share = invested / total if total else 0

    port = [sum(weights[s] / covered * rets[s][i] for s in rets) * invested_share for i in range(n)] if covered else []
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

    top = sorted(values, key=lambda s: values[s], reverse=True)[:10]
    corr = [[(round(c, 2) if (c := correlation(rets[a], rets[b])) is not None else None) if a in rets and b in rets else None
             for b in top] for a in top]
    off_diag = [c for i, row in enumerate(corr) for j, c in enumerate(row) if i < j and c is not None]

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
        "uncovered_pct": round((1 - covered) * 100, 2) if weights else 0.0,
        "uncovered_symbols": sorted(s for s in weights if s not in rets),
        "sectors": dict(sorted(((k, round(v, 2)) for k, v in sector_pct.items()), key=lambda kv: -kv[1])),
        "correlation": {"symbols": top, "matrix": corr},
        "avg_correlation": round(mean(off_diag), 2) if off_diag else None,
    }


def _beta_or_market(b: float | None) -> float:
    """A holding with no beta (too little history) is assumed to move with the market."""
    return b if b is not None else 1.0


def stress_scenarios(values: dict[str, float], cash: float, betas: dict[str, float | None],
                     crisis_drawdowns: dict[str, dict[str, float | None]],
                     benchmark_crisis: dict[str, float | None], crises: list[tuple[str, str]],
                     shocks: tuple[float, ...] = (-10.0, -20.0, -35.0)) -> list[JSONDict]:
    """Loss of today's portfolio under each scenario.

    Historical crises use each holding's own fall in that crisis; if it wasn't listed yet, its beta
    times the benchmark's fall (beta defaults to 1). Market shocks use beta times the shock.
    Losses are capped at -100% per holding; cash is assumed flat.
    """
    total = sum(values.values()) + cash

    def run(key: str, name: str, kind: str, per_symbol: dict[str, tuple[float, str]]) -> JSONDict:
        contribs: list[JSONDict] = []
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
                per[s] = (_beta_or_market(betas.get(s)) * (bench_dd or 0.0), "estimated from beta")
        out.append(run(key, name, "historical", per))
    for shock in shocks:
        per = {s: (_beta_or_market(betas.get(s)) * shock, "beta × market") for s in values}
        out.append(run(f"market{int(shock)}", f"Market falls {abs(shock):g}%", "hypothetical", per))
    return out
