import { api } from "../api";
import type { MetricRow } from "./filter";

/** The API takes at most this many symbols per request (`backend/app/screener.py` MAX_SYMBOLS). */
export const CHUNK = 25;

export interface Loaded {
  readonly rows: readonly MetricRow[];
  /** The API's data-source label; a `mock` label means the numbers are sample data. */
  readonly source: string;
}

/**
 * Fetch metrics for `symbols`, a chunk at a time and one chunk after the other, so a long list uses
 * a few requests of the per-minute quota instead of a burst. `onProgress` is told how many are done.
 * Only ticker symbols are sent: nothing about the user's portfolio or watchlist.
 *
 * @throws Error when a request fails; rows loaded before it are not returned.
 */
export async function loadMetrics(symbols: readonly string[], onProgress: (done: number) => void = () => undefined): Promise<Loaded> {
  const rows: MetricRow[] = [];
  const sources: string[] = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const chunk = symbols.slice(i, i + CHUNK);
    const out = await api<{ rows: MetricRow[]; data_source: string }>(`/screener/metrics?symbols=${encodeURIComponent(chunk.join(","))}`);
    rows.push(...out.rows);
    sources.push(out.data_source);
    onProgress(Math.min(i + CHUNK, symbols.length));
  }
  // one sample-data chunk labels the whole result: a screen must never present sample numbers as real
  const source = sources.find((s) => s.startsWith("mock")) ?? sources[0] ?? "";
  return { rows, source };
}
