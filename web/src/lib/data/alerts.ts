import { Alert, api, apiWithHeaders, Candle, Quote } from "../api";
import { heldValueByDay } from "../calc/portfolio";
import { breachMessage, lossLimitBreach, portfolioBreaches } from "../calc/check";
import { floatRepr } from "../calc/pyformat";
import { breachMessages } from "../calc/targets";
import { isSampleData } from "../dataSource";
import { isLocalMode } from "../localMode";
import { newId } from "../store";
import { portfolioStore } from "../store/shared";
import type { AlertRecord, PortfolioStore } from "../store";
import { evaluateTargets } from "./targets";
import { getPortfolio, LOCAL_BOOK } from "./portfolio";
import { getProfile, localRules } from "./riskProfile";
import { bookOf } from "./safetyCheck";

const DAY = 86_400;

/** What a pass did: how many alerts it raised, and what it had to skip. */
export interface AlertPass {
  readonly created: number;
  readonly skipped: readonly string[];
}

/**
 * One alert per condition until the user reads it; it can fire again after it is marked read.
 * Returns whether an alert was raised.
 */
async function emit(store: PortfolioStore, source: string, refId: string, symbol: string | null, dedupeKey: string, message: string): Promise<boolean> {
  const open = (await store.list("alerts")).some((a) => a.dedupeKey === dedupeKey && !a.read);
  if (open) return false;
  const record: Omit<AlertRecord, "updatedAt"> = { id: newId(), source, refId, symbol, message, dedupeKey, read: false, createdAt: new Date().toISOString() };
  await store.put("alerts", record);
  return true;
}

/**
 * The real-money holdings' fall from their one-year high, against the loss limit. Null when
 * there are no holdings. Throws when prices cannot be fetched; returns "sample" when the history
 * is sample data (an alert about a fall that did not happen is worse than none).
 */
async function lossLimit(holdings: readonly { symbol: string; quantity: number }[], rules: Awaited<ReturnType<typeof localRules>>): Promise<ReturnType<typeof lossLimitBreach> | "sample"> {
  const symbols = [...new Set(holdings.map((h) => h.symbol))].sort();
  const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
  const fetched = await Promise.all(symbols.map(async (s) => {
    const { data, headers } = await apiWithHeaders<Candle[]>(`/stocks/${encodeURIComponent(s)}/candles?resolution=D&start=${today - 365 * DAY}&end=${today}`);
    return { symbol: s, bars: data.map((b) => ({ t: b.t, c: b.c })), source: headers.get("X-Data-Source") };
  }));
  if (fetched.some((f) => isSampleData(f.source))) return "sample";
  const qty: Record<string, number> = {};
  for (const h of holdings) qty[h.symbol] = (qty[h.symbol] ?? 0) + h.quantity;
  const history = heldValueByDay(Object.fromEntries(fetched.map((f) => [f.symbol, f.bars])), qty);
  return lossLimitBreach(rules, history.map((p) => p.value));
}

async function riskRuleAlerts(store: PortfolioStore, skipped: string[]): Promise<number> {
  const snapshot = await getPortfolio(LOCAL_BOOK, true);
  const { book } = await bookOf(snapshot);
  const rules = await localRules();
  const breaches = portfolioBreaches(rules, book);
  const holdings = (await store.list("holdings")).filter((h) => snapshot.holdings.some((r) => r.id === h.id));
  if (holdings.length) {
    try {
      const fall = await lossLimit(holdings, rules);
      if (fall === "sample") skipped.push("loss limit: only sample prices are available");
      else if (fall) breaches.push(fall);
    } catch (e) {
      skipped.push(`loss limit: ${(e as Error).message}`); // the user's other alerts for this pass still go out
    }
  }
  let created = 0;
  for (const b of breaches) {
    const key = `risk:${b.rule.replace("_size", "")}:${b.subject}`;
    if (await emit(store, "risk", "0", b.rule === "position_size" ? b.subject : null, key, breachMessage(b))) created++;
  }
  return created;
}

async function targetAlerts(store: PortfolioStore): Promise<number> {
  let created = 0;
  for (const e of await evaluateTargets(true)) {
    for (const [key, message] of breachMessages(e)) {
      if (await emit(store, "target", String(e.target_id), e.symbol, key, message)) created++;
    }
  }
  return created;
}

async function watchAlerts(store: PortfolioStore): Promise<number> {
  const watched = (await store.list("watchlist")).filter((w) => w.alertAbove !== null || w.alertBelow !== null);
  let created = 0;
  for (const w of watched) {
    let price: number;
    try {
      price = (await api<Quote>(`/stocks/${encodeURIComponent(w.symbol)}/quote`)).price;
    } catch {
      continue; // no price now: check again next pass
    }
    if (w.alertAbove !== null && price >= w.alertAbove && await emit(store, "watch", w.id, w.symbol, `watch:${w.id}:above`, `${w.symbol} at ${floatRepr(price)} ≥ ${floatRepr(w.alertAbove)}`)) created++;
    if (w.alertBelow !== null && price <= w.alertBelow && await emit(store, "watch", w.id, w.symbol, `watch:${w.id}:below`, `${w.symbol} at ${floatRepr(price)} ≤ ${floatRepr(w.alertBelow)}`)) created++;
  }
  return created;
}

/**
 * Check the real-money book, the targets and the watchlist on this device and raise alerts for
 * what is breached: the server worker's pass, run in the app. Risk-rule alerts need a saved profile.
 */
export async function runAlertPass(): Promise<AlertPass> {
  const store = await portfolioStore();
  const skipped: string[] = [];
  let created = 0;
  if ((await getProfile(true)).saved) created += await riskRuleAlerts(store, skipped);
  if ((await store.list("targets")).length) created += await targetAlerts(store);
  created += await watchAlerts(store);
  return { created, skipped };
}

/** Newest first, at most 100. */
export async function listAlerts(local: boolean): Promise<Alert[]> {
  if (!local) return api<Alert[]>("/alerts");
  const records = await (await portfolioStore()).list("alerts");
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
    .map((a) => ({ id: a.id, source: a.source, symbol: a.symbol, message: a.message, read: a.read, created_at: a.createdAt }));
}

export async function markAllRead(): Promise<void> {
  if (!isLocalMode()) {
    await api("/alerts/read-all", { method: "POST" });
    return;
  }
  const store = await portfolioStore();
  for (const a of await store.list("alerts")) if (!a.read) await store.put("alerts", { ...a, read: true });
}
