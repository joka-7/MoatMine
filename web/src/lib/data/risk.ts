import { api, apiWithHeaders, BadTimes, Candle, PortfolioRisk, StressReport } from "../api";
import { returns } from "../calc/analytics";
import { breachMessage, portfolioBreaches } from "../calc/check";
import { RULE_KEYS } from "../calc/profile";
import { align, beta, portfolioRisk, stressScenarios, type Points } from "../calc/risk";
import { pyRound } from "../calc/round";
import { isSampleData } from "../dataSource";
import { getPortfolio, LOCAL_BOOK } from "./portfolio";
import { localRules } from "./riskProfile";
import { bookOf } from "./safetyCheck";

const BENCHMARK = "SPY";
const DAY = 86_400;

interface Bars {
  readonly points: Points;
  readonly source: string;
}

/** A year of daily closes for each symbol, with the data-source label the API reported for it. */
async function dailyBars(symbols: readonly string[]): Promise<Record<string, Bars>> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 365 * DAY;
  const fetched = await Promise.all(symbols.map(async (s) => {
    const { data, headers } = await apiWithHeaders<Candle[]>(`/stocks/${encodeURIComponent(s)}/candles?resolution=D&start=${start}&end=${end}`);
    return [s, { points: data.map((b) => [b.t, b.c] as const), source: headers.get("X-Data-Source") ?? "" }] as const;
  }));
  return Object.fromEntries(fetched);
}

/** One label for several results: a sample-data label wins, so the page never presents sample numbers as real. */
function combinedSource(labels: readonly string[]): string {
  return labels.find((l) => isSampleData(l)) ?? labels.find((l) => l) ?? "unknown";
}

/**
 * The risk of the real-money book as held through the last year, computed on this device from the
 * book here and daily prices fetched by symbol.
 *
 * @throws Error when prices for a held symbol or the benchmark cannot be fetched.
 */
export async function portfolioRiskReport(): Promise<PortfolioRisk> {
  const snapshot = await getPortfolio(LOCAL_BOOK, true);
  const { book, sectors } = await bookOf(snapshot);
  const rules = await localRules();
  const symbols = Object.keys(book.by_symbol).sort();
  const bars = await dailyBars([...symbols, BENCHMARK]);
  const series = Object.fromEntries(Object.entries(bars).map(([s, b]) => [s, b.points]));
  const { closes: aligned } = align(series);
  const bench = aligned[BENCHMARK] ?? null;
  const closes = Object.fromEntries(Object.entries(aligned).filter(([s]) => s !== BENCHMARK));
  const out = portfolioRisk(book.by_symbol, snapshot.totals.cash, closes, bench, sectors);

  // the aligned window is the shortest history; say which holding cut it if it is much shorter than the market's
  const held = symbols.filter((s) => (series[s]?.length ?? 0) > 0);
  const shortest = held.reduce<string | null>((a, s) => (a === null || (series[s]?.length ?? 0) < (series[a]?.length ?? 0) ? s : a), null);
  const benchLength = series[BENCHMARK]?.length ?? 0;
  const limitedBy = shortest !== null && (series[shortest]?.length ?? 0) < 0.9 * benchLength ? shortest : null;

  return {
    ...out,
    window_limited_by: limitedBy,
    breaches: portfolioBreaches(rules, book).map((b) => ({ rule: b.rule, subject: b.subject, message: breachMessage(b) })),
    rules: Object.fromEntries(RULE_KEYS.map((k) => [k, rules[k]])) as unknown as PortfolioRisk["rules"],
    data_source: combinedSource(Object.values(bars).map((b) => b.source)),
    mode: LOCAL_BOOK,
  };
}

/**
 * Today's real-money book replayed through past crises and market shocks, on this device. Each
 * holding's own fall in a crisis comes from the API's crises endpoint by symbol; betas come from
 * a year of daily prices.
 *
 * @throws Error when prices or crisis history cannot be fetched.
 */
export async function stressReport(): Promise<StressReport> {
  const snapshot = await getPortfolio(LOCAL_BOOK, true);
  const { book } = await bookOf(snapshot);
  const rules = await localRules();
  const symbols = Object.keys(book.by_symbol).sort();

  const [bars, benchCrises, ...ownCrises] = await Promise.all([
    dailyBars([...symbols, BENCHMARK]),
    api<BadTimes>(`/stocks/${BENCHMARK}/crises?benchmark=${BENCHMARK}`),
    ...symbols.map((s) => (s === BENCHMARK ? Promise.resolve(null) : api<BadTimes>(`/stocks/${encodeURIComponent(s)}/crises?benchmark=${BENCHMARK}`))),
  ]);
  const { closes } = align(Object.fromEntries(Object.entries(bars).map(([s, b]) => [s, b.points])));
  const benchReturns = returns(closes[BENCHMARK] ?? []);
  const betas = Object.fromEntries(symbols.map((s) => [s, closes[s] ? beta(returns(closes[s]), benchReturns) : null] as const));

  // the benchmark's own history is both the crisis list and the market's fall in each crisis
  const benchmarkCrisis = Object.fromEntries(benchCrises.crises.map((c) => [c.key, c.stock?.drawdown_pct ?? null] as const));
  const crisisDrawdowns = Object.fromEntries(symbols.map((s, i) => {
    const rows = s === BENCHMARK ? benchCrises : ownCrises[i];
    return [s, Object.fromEntries((rows?.crises ?? []).map((c) => [c.key, c.stock?.drawdown_pct ?? null] as const))] as const;
  }));

  const scenarios = stressScenarios(book.by_symbol, snapshot.totals.cash, betas, crisisDrawdowns, benchmarkCrisis, benchCrises.crises.map((c) => [c.key, c.name] as const))
    .map((sc) => ({ ...sc, breaches_limit: sc.change_pct < rules.max_drawdown_pct }));
  return {
    mode: LOCAL_BOOK,
    total_value: pyRound(Object.values(book.by_symbol).reduce((s, v) => s + v, 0) + snapshot.totals.cash),
    loss_limit_pct: rules.max_drawdown_pct,
    scenarios,
    note: "Replays past crises on today's holdings. Past falls don't predict future ones.",
    data_source: combinedSource([...Object.values(bars).map((b) => b.source), benchCrises.data_source, ...ownCrises.map((c) => c?.data_source ?? "")]),
  };
}
