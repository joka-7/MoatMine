import { UNIVERSE, type UniverseEntry } from "./universe";

/** One stock's metrics as the API returns them (`GET /screener/metrics`). Unknowns are null; a stock whose data failed has `error`. */
export interface MetricRow {
  readonly symbol: string;
  readonly error?: string;
  readonly price?: number | null;
  readonly perf_1m?: number | null;
  readonly perf_3m?: number | null;
  readonly perf_6m?: number | null;
  readonly perf_12m?: number | null;
  readonly momentum?: number | null;
  readonly vs_sma50?: number | null;
  readonly vs_sma200?: number | null;
  readonly rsi14?: number | null;
  readonly high_52w?: number | null;
  readonly low_52w?: number | null;
  readonly pct_from_high?: number | null;
  readonly pct_from_low?: number | null;
  readonly volatility_pct?: number | null;
  readonly max_drawdown_pct?: number | null;
  readonly pe?: number | null;
  readonly dividend_yield?: number | null;
  readonly beta?: number | null;
}

export type NumericKey = Exclude<keyof MetricRow, "symbol" | "error">;
export type PerfWindow = "perf_1m" | "perf_3m" | "perf_6m" | "perf_12m";

/** What the user asked for. An empty list or a null limit means "no restriction". */
export interface Filters {
  /** Where the company sits: these choose which companies get their data loaded. */
  readonly sectors: readonly string[];
  readonly industries: readonly string[];
  readonly countries: readonly string[];
  /** Value: price over earnings, positive (a loss-making company has no usable P/E). */
  readonly maxPe: number | null;
  /** Risk: yearly volatility and the worst fall in the last year, as positive percentages. */
  readonly maxVolatility: number | null;
  readonly maxDrawdown: number | null;
  /** Performance over one window, in percent. */
  readonly perfWindow: PerfWindow;
  readonly minPerf: number | null;
  readonly maxPerf: number | null;
  /** Momentum: the 12-1 month return, and whether the price is above its 200-day average. */
  readonly minMomentum: number | null;
  readonly aboveSma200: boolean;
  /** High and low: within this many percent of the 52-week high, or of the 52-week low. */
  readonly nearHigh: number | null;
  readonly nearLow: number | null;
}

export const NO_FILTERS: Filters = {
  sectors: [], industries: [], countries: [], maxPe: null, maxVolatility: null, maxDrawdown: null,
  perfWindow: "perf_3m", minPerf: null, maxPerf: null, minMomentum: null, aboveSma200: false, nearHigh: null, nearLow: null,
};

export const PRESETS = {
  nearLow: { ...NO_FILTERS, nearLow: 10 },
  momentum: { ...NO_FILTERS, minMomentum: 20, aboveSma200: true },
  lowRisk: { ...NO_FILTERS, maxVolatility: 25, maxDrawdown: 20 },
  cheap: { ...NO_FILTERS, maxPe: 15 },
} as const satisfies Record<string, Filters>;

const inList = (list: readonly string[], value: string) => list.length === 0 || list.includes(value);

/** The companies whose sector, industry and country match: the ones worth fetching data for. */
export function candidates(filters: Filters, universe: readonly UniverseEntry[] = UNIVERSE): UniverseEntry[] {
  return universe.filter((u) => inList(filters.sectors, u.sector) && inList(filters.industries, u.industry) && inList(filters.countries, u.country));
}

/** Passes a limit, or can't be checked: a missing number fails any limit that is set, so unknowns never slip through. */
const within = (value: number | null | undefined, ok: (v: number) => boolean): boolean => value !== null && value !== undefined && ok(value);

/** Whether a stock's numbers meet every metric filter the user set. Rows that failed to load never match. */
export function matches(row: MetricRow, f: Filters): boolean {
  if (row.error) return false;
  const { maxPe, maxVolatility, maxDrawdown, minPerf, maxPerf, minMomentum, nearHigh, nearLow } = f;
  if (maxPe !== null && !within(row.pe, (v) => v > 0 && v <= maxPe)) return false;
  if (maxVolatility !== null && !within(row.volatility_pct, (v) => v <= maxVolatility)) return false;
  if (maxDrawdown !== null && !within(row.max_drawdown_pct, (v) => v >= -maxDrawdown)) return false;
  if (minPerf !== null && !within(row[f.perfWindow], (v) => v >= minPerf)) return false;
  if (maxPerf !== null && !within(row[f.perfWindow], (v) => v <= maxPerf)) return false;
  if (minMomentum !== null && !within(row.momentum, (v) => v >= minMomentum)) return false;
  if (f.aboveSma200 && !within(row.vs_sma200, (v) => v > 0)) return false;
  if (nearHigh !== null && !within(row.pct_from_high, (v) => v >= -nearHigh)) return false;
  if (nearLow !== null && !within(row.pct_from_low, (v) => v <= nearLow)) return false;
  return true;
}

export type SortKey = NumericKey | "symbol";

/** Sorted copy; a missing value always goes last, whichever direction. */
export function sortRows(rows: readonly MetricRow[], key: SortKey, direction: "asc" | "desc"): MetricRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "symbol") return sign * a.symbol.localeCompare(b.symbol);
    const x = a[key];
    const y = b[key];
    const xMissing = x === null || x === undefined;
    const yMissing = y === null || y === undefined;
    if (xMissing || yMissing) return xMissing === yMissing ? 0 : xMissing ? 1 : -1;
    return sign * (x - y);
  });
}
