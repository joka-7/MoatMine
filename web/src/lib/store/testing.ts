import type { CollectionName, NewRecord } from "./types";

const AT = "2024-01-01T00:00:00.000Z";

const BASES: { readonly [K in CollectionName]: Omit<NewRecord<K>, "id"> } = {
  accounts: { name: "Main", broker: "manual", currency: "USD", cash: 100, createdAt: AT },
  holdings: { accountId: "a1", symbol: "AAPL", quantity: 2, avgCost: 150, openedAt: AT },
  watchlist: { symbol: "MSFT", note: "", alertAbove: null, alertBelow: 300, createdAt: AT },
  notes: { symbol: "AAPL", kind: "note", title: "Why", body: "Services", url: "", createdAt: AT },
  targets: {
    name: "Grow", symbol: null, profitTarget: 10, profitMin: 5, profitMax: null, amountTarget: null, amountMin: null, amountMax: null,
    periodTargetDays: 365, periodMinDays: null, periodMaxDays: null, intent: "growth", intentNote: "", riskTarget: null, riskMin: null, riskMax: 25,
    createdAt: AT,
  },
  alerts: { source: "target", refId: "t1", symbol: "AAPL", message: "Above max", dedupeKey: "t1:max", read: false, createdAt: AT },
  plans: {
    accountId: "a1", symbol: "AAPL", quantity: 1, price: 190, note: "", verdict: "pass", check: { items: [] }, status: "ready",
    availableAt: AT, createdAt: AT, executedHoldingId: null,
  },
  riskProfile: {
    level: "moderate", answers: { q1: 2 }, maxPositionPct: 8, maxSectorPct: 25, minSafetyScore: 60, maxVolatilityPct: 35, maxDrawdownPct: -20,
    minMarketCapM: 2000, allowPennyStocks: false, coolingOffHours: 24, paperMode: true,
  },
  aiSettings: { config: { providers: [] }, favorite: null },
};

/** A valid record of `collection` with this id, for tests. */
export function sample<K extends CollectionName>(collection: K, id: string, changes: Partial<Omit<NewRecord<K>, "id">> = {}): NewRecord<K> {
  return { id, ...BASES[collection], ...changes } as unknown as NewRecord<K>;
}
