import { api } from "../api";
import { COLLECTIONS, SINGLETON_ID, type CollectionName, type ImportSummary, type JsonObject, type PortfolioStore, type Stored, type StoreExport } from "../store";
import { PAPER_BROKER } from "../calc/portfolio";

/** What `GET /me/data` returns: the user's stored data in the API's own field names. */
export interface ServerData {
  accounts: { id: number; name: string; broker: string; currency: string; cash: number; created_at: string }[];
  holdings: { id: number; account_id: number; symbol: string; quantity: number; avg_cost: number; opened_at: string }[];
  watchlist: { id: number; symbol: string; note: string; alert_above: number | null; alert_below: number | null; created_at: string }[];
  notes: { id: number; symbol: string; kind: string; title: string; body: string; url: string; created_at: string }[];
  targets: {
    id: number; name: string; symbol: string | null; intent: string; intent_note: string; created_at: string;
    profit_target: number | null; profit_min: number | null; profit_max: number | null;
    amount_target: number | null; amount_min: number | null; amount_max: number | null;
    period_target_days: number | null; period_min_days: number | null; period_max_days: number | null;
    risk_target: number | null; risk_min: number | null; risk_max: number | null;
  }[];
  alerts: { id: number; source: string; ref_id: number; symbol: string | null; message: string; dedupe_key: string; read: boolean; created_at: string }[];
  plans: {
    id: number; account_id: number; symbol: string; quantity: number; price: number; note: string; verdict: string;
    check: JsonObject; status: string; available_at: string; created_at: string; executed_holding_id: number | null;
  }[];
  risk_profile: {
    saved: boolean; level: string; answers: JsonObject; paper_mode: boolean; max_position_pct: number; max_sector_pct: number;
    min_safety_score: number; max_volatility_pct: number; max_drawdown_pct: number; min_market_cap_m: number;
    allow_penny_stocks: boolean; cooling_off_hours: number;
  } | null;
}

/** How many records of each kind the move covers. */
export type Counts = Readonly<Record<CollectionName, number>>;

export interface MovePlan {
  /** The records to copy, as one importable file. */
  readonly file: StoreExport;
  /** What will be on the device afterwards. */
  readonly counts: Counts;
  /** Paper (practice) accounts cannot live on the device yet: they are not copied, with their positions and plans. */
  readonly leftBehind: { readonly accounts: number; readonly holdings: number; readonly plans: number };
}

/** The same server row always becomes the same device id, so running the move twice adds nothing. */
const deviceId = (collection: CollectionName, serverId: number): string => `migrated-${collection}-${serverId}`;

/**
 * Turn a server export into records for the device store. Real-money accounts and what hangs off
 * them are copied; paper accounts, their positions and their plans are counted but left behind.
 */
export function planMove(server: ServerData, now: Date): MovePlan {
  const updatedAt = now.toISOString();
  const real = new Set(server.accounts.filter((a) => a.broker !== PAPER_BROKER).map((a) => a.id));
  const realHoldings = server.holdings.filter((h) => real.has(h.account_id));
  const realPlans = server.plans.filter((p) => real.has(p.account_id));
  const heldIds = new Set(realHoldings.map((h) => h.id));

  const records: { [K in CollectionName]: Stored<K>[] } = {
    accounts: server.accounts.filter((a) => real.has(a.id)).map((a) => ({
      id: deviceId("accounts", a.id), updatedAt, name: a.name, broker: a.broker, currency: a.currency, cash: a.cash, createdAt: a.created_at,
    })),
    holdings: realHoldings.map((h) => ({
      id: deviceId("holdings", h.id), updatedAt, accountId: deviceId("accounts", h.account_id), symbol: h.symbol,
      quantity: h.quantity, avgCost: h.avg_cost, openedAt: h.opened_at,
    })),
    watchlist: server.watchlist.map((w) => ({
      id: deviceId("watchlist", w.id), updatedAt, symbol: w.symbol, note: w.note, alertAbove: w.alert_above, alertBelow: w.alert_below, createdAt: w.created_at,
    })),
    notes: server.notes.map((n) => ({
      id: deviceId("notes", n.id), updatedAt, symbol: n.symbol, kind: n.kind, title: n.title, body: n.body, url: n.url, createdAt: n.created_at,
    })),
    targets: server.targets.map((t) => ({
      id: deviceId("targets", t.id), updatedAt, name: t.name, symbol: t.symbol,
      profitTarget: t.profit_target, profitMin: t.profit_min, profitMax: t.profit_max,
      amountTarget: t.amount_target, amountMin: t.amount_min, amountMax: t.amount_max,
      periodTargetDays: t.period_target_days, periodMinDays: t.period_min_days, periodMaxDays: t.period_max_days,
      intent: t.intent, intentNote: t.intent_note, riskTarget: t.risk_target, riskMin: t.risk_min, riskMax: t.risk_max, createdAt: t.created_at,
    })),
    alerts: server.alerts.map((a) => ({
      id: deviceId("alerts", a.id), updatedAt, source: a.source, refId: String(a.ref_id), symbol: a.symbol, message: a.message,
      dedupeKey: a.dedupe_key, read: a.read, createdAt: a.created_at,
    })),
    plans: realPlans.map((p) => ({
      id: deviceId("plans", p.id), updatedAt, accountId: deviceId("accounts", p.account_id), symbol: p.symbol, quantity: p.quantity,
      price: p.price, note: p.note, verdict: p.verdict, check: p.check, status: p.status, availableAt: p.available_at, createdAt: p.created_at,
      executedHoldingId: p.executed_holding_id !== null && heldIds.has(p.executed_holding_id) ? deviceId("holdings", p.executed_holding_id) : null,
    })),
    riskProfile: server.risk_profile?.saved ? [{
      id: SINGLETON_ID, updatedAt, level: server.risk_profile.level, answers: server.risk_profile.answers,
      maxPositionPct: server.risk_profile.max_position_pct, maxSectorPct: server.risk_profile.max_sector_pct,
      minSafetyScore: server.risk_profile.min_safety_score, maxVolatilityPct: server.risk_profile.max_volatility_pct,
      maxDrawdownPct: server.risk_profile.max_drawdown_pct, minMarketCapM: server.risk_profile.min_market_cap_m,
      allowPennyStocks: server.risk_profile.allow_penny_stocks, coolingOffHours: server.risk_profile.cooling_off_hours,
      paperMode: server.risk_profile.paper_mode,
    }] : [],
    aiSettings: [], // AI settings and their keys are not part of this move
  };

  return {
    file: { app: "moatmine", version: 1, exportedAt: updatedAt, collections: records },
    counts: Object.fromEntries(COLLECTIONS.map((c) => [c, records[c].length])) as Counts,
    leftBehind: {
      accounts: server.accounts.length - real.size,
      holdings: server.holdings.length - realHoldings.length,
      plans: server.plans.length - realPlans.length,
    },
  };
}

export const fetchServerData = (): Promise<ServerData> => api<ServerData>("/me/data");

/**
 * Copy the planned records onto the device, then read every one back by id.
 *
 * @returns what the import did and the ids that were not found afterwards (empty when the copy is complete).
 * @throws ImportError when the file does not pass the store's validation.
 */
export async function copyToDevice(store: PortfolioStore, plan: MovePlan): Promise<{ summary: ImportSummary; missing: string[] }> {
  const summary = await store.importAll(plan.file, "merge");
  const missing: string[] = [];
  for (const collection of COLLECTIONS) {
    for (const record of plan.file.collections[collection]) {
      if (!(await store.get(collection, record.id))) missing.push(`${collection}/${record.id}`);
    }
  }
  return { summary, missing };
}

/** Delete the user's portfolio data from the server for good; returns how many rows of each kind went. */
export const deleteServerData = (): Promise<Record<string, number>> => api<Record<string, number>>("/me/data", { method: "DELETE" });
