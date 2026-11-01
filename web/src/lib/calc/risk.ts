import { maxDrawdownPct, mean, pstdev, returns } from "./analytics";
import { pyRound } from "./round";
import { general } from "./pyformat";

const TRADING_DAYS = 252;
const Z95 = 1.645;
const DAY = 86_400;

/** A price series as (unix seconds, close) pairs. */
export type Points = readonly (readonly [number, number])[];

/** Keep only the days every series has (by UTC day), returning closes in date order. */
export function align(series: Readonly<Record<string, Points>>): { days: number[]; closes: Record<string, number[]> } {
  const byDay = Object.entries(series)
    .filter(([, pts]) => pts.length)
    .map(([s, pts]) => [s, new Map(pts.map(([t, c]) => [t - (t % DAY), c] as const))] as const);
  if (!byDay.length) return { days: [], closes: {} };
  const firstMap = (byDay[0] as readonly [string, Map<number, number>])[1];
  const days = [...firstMap.keys()].filter((d) => byDay.every(([, m]) => m.has(d))).sort((a, b) => a - b);
  const closes: Record<string, number[]> = {};
  for (const [s, m] of byDay) closes[s] = days.map((d) => m.get(d) as number);
  return { days, closes };
}

/** Sensitivity of an asset's returns to a benchmark's; null with under 20 points or a flat benchmark. */
export function beta(asset: readonly number[], bench: readonly number[]): number | null {
  if (asset.length !== bench.length || asset.length < 20) return null;
  const ma = mean(asset);
  const mb = mean(bench);
  const varB = bench.reduce((s, b) => s + (b - mb) ** 2, 0);
  if (!varB) return null;
  return asset.reduce((s, a, i) => s + (a - ma) * ((bench[i] as number) - mb), 0) / varB;
}

export function correlation(x: readonly number[], y: readonly number[]): number | null {
  if (x.length !== y.length || x.length < 20) return null;
  const sx = pstdev(x);
  const sy = pstdev(y);
  if (!sx || !sy) return null;
  const mx = mean(x);
  const my = mean(y);
  return x.reduce((s, a, i) => s + (a - mx) * ((y[i] as number) - my), 0) / x.length / (sx * sy);
}

export interface PortfolioRiskNumbers {
  total_value: number;
  invested_value: number;
  cash_pct: number;
  days: number;
  volatility_pct: number | null;
  beta: number | null;
  var95_1d: number | null;
  var95_1m: number | null;
  max_drawdown_pct: number | null;
  top_position_pct: number | null;
  effective_holdings: number | null;
  holdings_count: number;
  uncovered_pct: number;
  uncovered_symbols: string[];
  sectors: Record<string, number>;
  correlation: { symbols: string[]; matrix: (number | null)[][] };
  avg_correlation: number | null;
}

/**
 * Risk of the current holdings, as if held through the price history given. `closes` must already be
 * aligned. Holdings with no price history are assumed to move like the ones that have it (weights
 * are renormalised over the covered holdings); `uncovered_pct` says how much of the invested value
 * that assumption covers.
 *
 * Twin of `portfolio_risk` in `backend/app/safety/risk.py`; `backend/tests/vectors/calc.json` checks both.
 */
export function portfolioRisk(
  values: Readonly<Record<string, number>>,
  cash: number,
  closes: Readonly<Record<string, readonly number[]>>,
  bench: readonly number[] | null,
  sectors: Readonly<Record<string, string | null | undefined>>,
): PortfolioRiskNumbers {
  const entries = Object.entries(values);
  const invested = entries.reduce((s, [, v]) => s + v, 0);
  const total = invested + cash;
  const weights = invested ? entries.map(([s, v]) => [s, v / invested] as const) : [];
  const rets = weights.filter(([s]) => s in closes).map(([s]) => [s, returns(closes[s] as number[])] as const);
  const retOf = new Map(rets);
  const weightOf = new Map(weights);
  const n = rets.length ? Math.min(...rets.map(([, r]) => r.length)) : 0;
  const covered = rets.reduce((s, [sym]) => s + (weightOf.get(sym) as number), 0);
  const investedShare = total ? invested / total : 0;

  const port: number[] = [];
  if (covered) {
    for (let i = 0; i < n; i++) {
      port.push(rets.reduce((s, [sym, r]) => s + ((weightOf.get(sym) as number) / covered) * (r[i] as number), 0) * investedShare);
    }
  }
  const sd = port.length > 1 ? pstdev(port) : null;
  const benchRets = bench ? returns(bench).slice(0, n) : null;

  const index: number[] = [];
  let level = 1;
  for (const r of port) {
    level *= 1 + r;
    index.push(level);
  }

  const hhi = weights.reduce((s, [, w]) => s + w * w, 0);
  const sectorPct = new Map<string, number>();
  for (const [s, v] of entries) {
    const key = sectors[s] || "Unknown";
    sectorPct.set(key, (sectorPct.get(key) ?? 0) + (total ? (v / total) * 100 : 0));
  }

  const top = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s]) => s);
  const matrix = top.map((a) => top.map((b) => {
    const ra = retOf.get(a);
    const rb = retOf.get(b);
    if (!ra || !rb) return null;
    const c = correlation(ra, rb);
    return c === null ? null : pyRound(c);
  }));
  const offDiag = matrix.flatMap((row, i) => row.flatMap((c, j) => (i < j && c !== null ? [c] : [])));
  const b = benchRets && benchRets.length ? beta(port, benchRets) : null;
  const biggest = entries.length ? Math.max(...entries.map(([, v]) => v)) : 0;

  return {
    total_value: pyRound(total),
    invested_value: pyRound(invested),
    cash_pct: total ? pyRound((cash / total) * 100) : 0,
    days: n,
    volatility_pct: sd !== null ? pyRound(sd * Math.sqrt(TRADING_DAYS) * 100) : null,
    beta: b !== null ? pyRound(b) : null,
    var95_1d: sd !== null ? pyRound(Z95 * sd * total) : null,
    var95_1m: sd !== null ? pyRound(Z95 * sd * Math.sqrt(21) * total) : null,
    max_drawdown_pct: maxDrawdownPct(index),
    top_position_pct: entries.length && total ? pyRound((biggest / total) * 100) : null,
    effective_holdings: hhi ? pyRound(1 / hhi, 1) : null,
    holdings_count: entries.length,
    uncovered_pct: weights.length ? pyRound((1 - covered) * 100) : 0,
    uncovered_symbols: weights.map(([s]) => s).filter((s) => !retOf.has(s)).sort(),
    sectors: Object.fromEntries([...sectorPct].map(([k, v]) => [k, pyRound(v)] as const).sort((a, b2) => b2[1] - a[1])),
    correlation: { symbols: top, matrix },
    avg_correlation: offDiag.length ? pyRound(mean(offDiag)) : null,
  };
}

export interface StressContribution {
  symbol: string;
  change_pct: number;
  change: number;
  basis: string;
}

export interface StressScenarioNumbers {
  key: string;
  name: string;
  kind: "historical" | "hypothetical";
  change: number;
  change_pct: number;
  worst: StressContribution[];
  holdings: StressContribution[];
}

/**
 * Loss of today's portfolio under each scenario. Historical crises use each holding's own fall in
 * that crisis; if it was not listed yet, its beta (1 if unknown) times the benchmark's fall. Market
 * shocks use beta times the shock. Losses are capped at -100% per holding; cash is assumed flat.
 *
 * Twin of `stress_scenarios` in `backend/app/safety/risk.py`; `backend/tests/vectors/calc.json` checks both.
 */
export function stressScenarios(
  values: Readonly<Record<string, number>>,
  cash: number,
  betas: Readonly<Record<string, number | null | undefined>>,
  crisisDrawdowns: Readonly<Record<string, Readonly<Record<string, number | null | undefined>> | undefined>>,
  benchmarkCrisis: Readonly<Record<string, number | null | undefined>>,
  crises: readonly (readonly [string, string])[],
  shocks: readonly number[] = [-10, -20, -35],
): StressScenarioNumbers[] {
  const entries = Object.entries(values);
  const total = entries.reduce((s, [, v]) => s + v, 0) + cash;
  const betaOrMarket = (s: string) => betas[s] ?? 1;

  const run = (key: string, name: string, kind: StressScenarioNumbers["kind"], perSymbol: Map<string, readonly [number, string]>): StressScenarioNumbers => {
    const contribs = entries.map(([s, v]): StressContribution => {
      const [raw, basis] = perSymbol.get(s) as readonly [number, string];
      const pct = Math.max(-100, raw);
      return { symbol: s, change_pct: pyRound(pct, 1), change: pyRound((v * pct) / 100), basis };
    });
    const loss = contribs.reduce((s, c) => s + c.change, 0);
    return {
      key, name, kind, change: pyRound(loss), change_pct: total ? pyRound((loss / total) * 100) : 0,
      worst: [...contribs].sort((a, b) => a.change - b.change).slice(0, 3), holdings: contribs,
    };
  };

  const out: StressScenarioNumbers[] = [];
  for (const [key, name] of crises) {
    const benchDd = benchmarkCrisis[key];
    const per = new Map<string, readonly [number, string]>();
    for (const [s] of entries) {
      const own = crisisDrawdowns[s]?.[key];
      per.set(s, own !== null && own !== undefined ? [own, "actual fall"] : [betaOrMarket(s) * (benchDd || 0), "estimated from beta"]);
    }
    out.push(run(key, name, "historical", per));
  }
  for (const shock of shocks) {
    const per = new Map(entries.map(([s]) => [s, [betaOrMarket(s) * shock, "beta × market"] as const] as const));
    out.push(run(`market${Math.trunc(shock)}`, `Market falls ${general(Math.abs(shock))}%`, "hypothetical", per));
  }
  return out;
}
