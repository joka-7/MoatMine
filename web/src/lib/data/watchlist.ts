import { api, Quote, WatchRow } from "../api";
import { isLocalMode } from "../localMode";
import { newId } from "../store";
import { portfolioStore } from "../store/shared";
import type { WatchRecord } from "../store";

export interface WatchInput {
  symbol: string;
  note: string;
  alert_above: number | null;
  alert_below: number | null;
}

async function quoteOrNull(symbol: string): Promise<Quote | null> {
  try {
    return await api<Quote>(`/stocks/${encodeURIComponent(symbol)}/quote`);
  } catch {
    return null; // one symbol without a price should not hide the rest of the list
  }
}

async function localRows(): Promise<WatchRow[]> {
  const records = [...(await (await portfolioStore()).list("watchlist"))].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const quotes = await Promise.all(records.map((r) => quoteOrNull(r.symbol)));
  return records.map((r, i) => ({
    id: r.id, symbol: r.symbol, note: r.note, alert_above: r.alertAbove, alert_below: r.alertBelow, quote: quotes[i] ?? null,
  }));
}

/** The watchlist with live quotes, from this device in local mode, else from the server. */
export function listWatch(local: boolean): Promise<WatchRow[]> {
  return local ? localRows() : api<WatchRow[]>("/watchlist");
}

/**
 * Add a symbol to the watchlist.
 *
 * @throws Error when the symbol is already on it.
 */
export async function addWatch(input: WatchInput): Promise<void> {
  if (!isLocalMode()) {
    await api("/watchlist", { method: "POST", json: input });
    return;
  }
  const store = await portfolioStore();
  const symbol = input.symbol.trim().toUpperCase();
  if ((await store.list("watchlist")).some((w) => w.symbol === symbol)) throw new Error(`${symbol} already on watchlist`);
  const record: Omit<WatchRecord, "updatedAt"> = {
    id: newId(), symbol, note: input.note, alertAbove: input.alert_above, alertBelow: input.alert_below,
    createdAt: new Date().toISOString(),
  };
  await store.put("watchlist", record);
}

export async function removeWatch(id: number | string): Promise<void> {
  if (isLocalMode()) await (await portfolioStore()).remove("watchlist", String(id));
  else await api(`/watchlist/${id}`, { method: "DELETE" });
}
