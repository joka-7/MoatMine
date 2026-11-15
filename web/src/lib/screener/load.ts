import { api } from "../api";
import type { MetricRow } from "./filter";

/**
 * Companies asked for per request. Small on purpose: on a free data plan each company costs a few
 * upstream calls, so a request of six answers in seconds and the table can fill in as they arrive,
 * where one of thirty can sit for a minute while the feed rate-limits.
 */
export const CHUNK = 6;
/** One request's budget; the server cuts a single company off at 20 seconds, so this is generous. */
export const REQUEST_TIMEOUT_MS = 60_000;
/** After this many requests in a row fail, the feed is down or refusing: stop instead of grinding on. */
export const MAX_CONSECUTIVE_FAILURES = 3;

export interface Loaded {
  readonly rows: readonly MetricRow[];
  /** The API's data-source label; a `mock` label means the numbers are sample data. */
  readonly source: string;
  /** The user pressed Stop; `rows` holds what had arrived. */
  readonly cancelled: boolean;
  /** Companies never asked for, because the requests kept failing or the user stopped. */
  readonly notLoaded: readonly string[];
}

export interface LoadOptions {
  /** Called after every request with everything loaded so far, the source label and how many are done. */
  readonly onProgress?: (rows: readonly MetricRow[], source: string, done: number) => void;
  readonly signal?: AbortSignal;
}

const sampleFirst = (sources: readonly string[]): string => sources.find((s) => s.startsWith("mock")) ?? sources[0] ?? "";

/** An error code for companies whose whole request failed, in the vocabulary of the server's per-company codes. */
function failureCode(e: unknown): string {
  const status = (e as { status?: number }).status;
  if (status === 429) return "rate_limited";
  return (e as Error).name === "TimeoutError" ? "timeout" : "no_data";
}

/**
 * Fetch metrics for `symbols` a few at a time, one request after the other. A request that fails
 * marks just its companies as failed and the rest carry on; `MAX_CONSECUTIVE_FAILURES` in a row
 * stops the run. Only ticker symbols are sent: nothing about the user's portfolio or watchlist.
 * Never throws for a feed problem: read `rows`, `cancelled` and `notLoaded`.
 */
export async function loadMetrics(symbols: readonly string[], options: LoadOptions = {}): Promise<Loaded> {
  const { onProgress, signal } = options;
  const rows: MetricRow[] = [];
  const sources: string[] = [];
  let failures = 0;
  let next = 0;
  while (next < symbols.length) {
    if (signal?.aborted) break;
    if (failures >= MAX_CONSECUTIVE_FAILURES) break;
    const chunk = symbols.slice(next, next + CHUNK);
    try {
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const out = await api<{ rows: MetricRow[]; data_source: string }>(`/screener/metrics?symbols=${encodeURIComponent(chunk.join(","))}`, {
        signal: signal ? anySignal([signal, timeout]) : timeout,
      });
      rows.push(...out.rows);
      sources.push(out.data_source);
      failures = 0;
    } catch (e) {
      if (signal?.aborted) break;
      rows.push(...chunk.map((symbol): MetricRow => ({ symbol, error: failureCode(e) })));
      failures++;
    }
    next += chunk.length;
    onProgress?.(rows, sampleFirst(sources), next);
  }
  return { rows, source: sampleFirst(sources), cancelled: signal?.aborted ?? false, notLoaded: symbols.slice(next) };
}

/** An AbortSignal that aborts when any of `signals` does (AbortSignal.any is not in every browser yet). */
function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}
