import type { Check, CheckStatus, Evaluation, Portfolio } from "../api";
import { pyRound } from "./round";
import type { CalcTarget } from "./types";

/** Where a value sits against its target and its MAMI (min/max) bounds. */
export function checkBound(value: number | null, target: number | null, lo: number | null, hi: number | null): Check {
  let status: CheckStatus;
  if (value === null) status = "no_data";
  else if (lo !== null && value < lo) status = "below_min";
  else if (hi !== null && value > hi) status = "above_max";
  else if (target === null && lo === null && hi === null) status = "unset";
  else if (target !== null && value >= target) status = "reached";
  else status = "ok";
  // a target of 0 has no progress, as in the Python (`if ... and target`)
  const progress_pct = value !== null && target ? pyRound((value / target) * 100, 1) : null;
  return { value, target, min: lo, max: hi, status, progress_pct };
}

function daysSince(isoDates: readonly string[], now: Date): number | null {
  if (!isoDates.length) return null;
  // a date with no UTC offset is read as UTC, as the Python does, not as local time
  const first = Math.min(...isoDates.map((d) => Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(d) ? d : `${d}Z`)));
  return Math.floor((now.getTime() - first) / 86_400_000);
}

/**
 * Evaluate one PAPI target against a priced snapshot. `risks` is annualised volatility per symbol,
 * null where real prices were not available. An unpriced holding gives no profit or amount rather
 * than a plausible-looking 0%.
 *
 * Twin of `evaluate` in `backend/app/targets.py`; `backend/tests/vectors/calc.json` checks both.
 */
export function evaluateTarget(
  t: CalcTarget,
  snapshot: Portfolio,
  risks: Readonly<Record<string, number | null | undefined>>,
  now: Date,
): Evaluation & { unpriced: string[] } {
  const holdings = snapshot.holdings;
  let rows = holdings;
  let profit: number | null;
  let amount: number | null;
  let risk: number | null;

  if (t.symbol) {
    rows = holdings.filter((h) => h.symbol === t.symbol);
    const priced = !rows.some((h) => h.stale);
    const cost = rows.reduce((s, h) => s + h.cost, 0);
    const value = rows.reduce((s, h) => s + h.value, 0);
    profit = cost && priced ? pyRound((value / cost - 1) * 100) : null;
    amount = rows.length && priced ? pyRound(value) : null;
    risk = risks[t.symbol] ?? null;
  } else {
    const tot = snapshot.totals;
    const priced = tot.unpriced.length === 0;
    profit = tot.cost && priced ? tot.pnl_pct : null;
    amount = priced ? tot.net_worth : null;
    const known = rows.flatMap((h) => {
      const r = risks[h.symbol];
      return r === null || r === undefined ? [] : [{ value: h.value, risk: r }];
    });
    const weight = known.reduce((s, k) => s + k.value, 0);
    risk = weight ? pyRound(known.reduce((s, k) => s + k.value * k.risk, 0) / weight) : null;
  }

  const period = daysSince(rows.map((h) => h.opened_at), now);
  const checks = {
    profit: checkBound(profit, t.profit_target, t.profit_min, t.profit_max),
    amount: checkBound(amount, t.amount_target, t.amount_min, t.amount_max),
    period: checkBound(period, t.period_target_days, t.period_min_days, t.period_max_days),
    intent: { ...checkBound(risk, t.risk_target, t.risk_min, t.risk_max), intent: t.intent, note: t.intent_note },
  };
  const breaches = (Object.keys(checks) as (keyof typeof checks)[]).filter((k) => checks[k].status === "below_min" || checks[k].status === "above_max");
  return {
    target_id: t.id, name: t.name, symbol: t.symbol, checks, breaches,
    unpriced: [...new Set(rows.filter((h) => h.stale).map((h) => h.symbol))].sort(),
  };
}
