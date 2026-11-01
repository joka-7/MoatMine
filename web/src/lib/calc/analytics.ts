import { pyRound } from "./round";

const TRADING_DAYS = 252;

/** Simple returns between consecutive closes; a zero close has no return from it. */
export function returns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1] as number;
    if (a) out.push((closes[i] as number) / a - 1);
  }
  return out;
}

/**
 * Annualised volatility in percent (population standard deviation of daily returns), or null with
 * fewer than two returns.
 *
 * Twin of `annual_volatility_pct` in `backend/app/analytics.py`; `backend/tests/vectors/calc.json` checks both.
 */
export function annualVolatilityPct(closes: readonly number[]): number | null {
  const r = returns(closes);
  if (r.length <= 1) return null;
  return pyRound(pstdev(r) * Math.sqrt(TRADING_DAYS) * 100);
}

/** Population standard deviation. */
export function pstdev(xs: readonly number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
}

export function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Worst fall from a running peak, in percent (negative or 0), or null for no prices. Twin of `max_drawdown_pct`. */
export function maxDrawdownPct(closes: readonly number[]): number | null {
  const first = closes[0];
  if (first === undefined) return null;
  let peak = first;
  let worst = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    worst = Math.min(worst, c / peak - 1);
  }
  return pyRound(worst * 100);
}
