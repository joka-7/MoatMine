import { apiWithHeaders, Candle } from "../api";
import { heldValueByDay } from "../calc/portfolio";
import type { BookMode } from "../calc/types";
import { isSampleData } from "../dataSource";
import { getPortfolio, LOCAL_BOOK } from "./portfolio";

const DAY = 86_400;

export interface ValueHistory {
  readonly points: { t: number; value: number }[];
  /** The API's data-source label; a sample-data label means the line is not real prices. */
  readonly source: string;
}

/**
 * Daily value of the book's current holdings (quantities held constant) over the last `days`:
 * from the server, or on this device from the on-device holdings and daily bars fetched by symbol.
 * A sample-price series labels the whole line as sample data.
 *
 * @throws Error when prices for a held symbol cannot be fetched.
 */
export async function portfolioHistory(days: number, mode: BookMode, local: boolean): Promise<ValueHistory> {
  if (!local) {
    const { data, headers } = await apiWithHeaders<{ t: number; value: number }[]>(`/portfolio/history?days=${days}&mode=${mode}`);
    return { points: data, source: headers.get("X-Data-Source") ?? "" };
  }
  const snapshot = await getPortfolio(LOCAL_BOOK, true);
  const qty: Record<string, number> = {};
  for (const h of snapshot.holdings) qty[h.symbol] = (qty[h.symbol] ?? 0) + h.quantity;
  const symbols = Object.keys(qty).sort();
  if (!symbols.length) return { points: [], source: "" };
  const end = Math.floor(Date.now() / 1000);
  const fetched = await Promise.all(symbols.map(async (s) => {
    const { data, headers } = await apiWithHeaders<Candle[]>(`/stocks/${encodeURIComponent(s)}/candles?resolution=D&start=${end - days * DAY}&end=${end}`);
    return { symbol: s, bars: data.map((b) => ({ t: b.t, c: b.c })), source: headers.get("X-Data-Source") ?? "" };
  }));
  const source = fetched.map((f) => f.source).find((s) => isSampleData(s)) ?? fetched.map((f) => f.source).find((s) => s) ?? "";
  return { points: heldValueByDay(Object.fromEntries(fetched.map((f) => [f.symbol, f.bars])), qty), source };
}
