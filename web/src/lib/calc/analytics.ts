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
  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const variance = r.reduce((s, x) => s + (x - mean) ** 2, 0) / r.length;
  return pyRound(Math.sqrt(variance) * Math.sqrt(TRADING_DAYS) * 100);
}
