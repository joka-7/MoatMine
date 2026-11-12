import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { LocalStore, MemoryBackend } from "../store";
import { copyToDevice, deleteServerData, fetchServerData, planMove, type ServerData } from "./migrate";

vi.mock("../api", () => ({ api: vi.fn() }));
const mockedApi = vi.mocked(api);

const NOW = new Date("2026-03-02T12:00:00.000Z");
const T = "2026-01-01T00:00:00+00:00";

const target = (id: number, changes: Partial<ServerData["targets"][number]> = {}): ServerData["targets"][number] => ({
  id, name: "Growth", symbol: null, intent: "growth", intent_note: "", created_at: T,
  profit_target: null, profit_min: -10, profit_max: null, amount_target: null, amount_min: null, amount_max: null,
  period_target_days: null, period_min_days: null, period_max_days: null, risk_target: null, risk_min: null, risk_max: 35, ...changes,
});

const server = (): ServerData => ({
  accounts: [
    { id: 1, name: "IBKR", broker: "manual", currency: "USD", cash: 1000, created_at: T },
    { id: 2, name: "Practice", broker: "paper", currency: "USD", cash: 500, created_at: T },
  ],
  holdings: [
    { id: 10, account_id: 1, symbol: "AAPL", quantity: 10, avg_cost: 150, opened_at: T },
    { id: 11, account_id: 2, symbol: "MSFT", quantity: 1, avg_cost: 300, opened_at: T },
  ],
  watchlist: [{ id: 5, symbol: "NVDA", note: "why", alert_above: 900, alert_below: null, created_at: T }],
  notes: [{ id: 6, symbol: "AAPL", kind: "thesis", title: "t", body: "b", url: "", created_at: T }],
  targets: [target(7)],
  alerts: [{ id: 8, source: "watch", ref_id: 5, symbol: "NVDA", message: "NVDA at 900.0 ≥ 900.0", dedupe_key: "watch:5:above", read: false, created_at: T }],
  plans: [
    { id: 20, account_id: 1, symbol: "AAPL", quantity: 10, price: 150, note: "", verdict: "pass", check: { verdict: "pass" }, status: "executed", available_at: T, created_at: T, executed_holding_id: 10 },
    { id: 21, account_id: 2, symbol: "MSFT", quantity: 1, price: 300, note: "", verdict: "pass", check: { verdict: "pass" }, status: "ready", available_at: T, created_at: T, executed_holding_id: null },
    { id: 22, account_id: 1, symbol: "AAPL", quantity: 1, price: 150, note: "", verdict: "pass", check: {}, status: "executed", available_at: T, created_at: T, executed_holding_id: 11 },
  ],
  risk_profile: {
    saved: true, level: "growth", answers: { horizon: 3 }, paper_mode: false, max_position_pct: 15, max_sector_pct: 40, min_safety_score: 40,
    max_volatility_pct: 60, max_drawdown_pct: -35, min_market_cap_m: 300, allow_penny_stocks: false, cooling_off_hours: 12,
  },
});

beforeEach(() => mockedApi.mockReset());

describe("planMove", () => {
  it("copies real-money accounts and their positions and plans, leaving paper ones behind and counting them", () => {
    const plan = planMove(server(), NOW);
    expect(plan.counts).toEqual({ accounts: 1, holdings: 1, watchlist: 1, notes: 1, targets: 1, alerts: 1, plans: 2, riskProfile: 1, aiSettings: 0 });
    expect(plan.leftBehind).toEqual({ accounts: 1, holdings: 1, plans: 1 });
  });

  it("gives each server row a stable device id and points children at the new parent ids", () => {
    const { file } = planMove(server(), NOW);
    expect(file.collections.accounts[0]).toMatchObject({ id: "migrated-accounts-1", name: "IBKR", cash: 1000 });
    expect(file.collections.holdings[0]).toMatchObject({ id: "migrated-holdings-10", accountId: "migrated-accounts-1", avgCost: 150 });
    expect(file.collections.plans[0]).toMatchObject({ id: "migrated-plans-20", accountId: "migrated-accounts-1", executedHoldingId: "migrated-holdings-10" });
  });

  it("drops a plan's link to a position that was not copied", () => {
    const { file } = planMove(server(), NOW);
    expect(file.collections.plans[1]).toMatchObject({ id: "migrated-plans-22", executedHoldingId: null });
  });

  it("converts watchlist, notes, targets and alerts to the device's field names", () => {
    const { file } = planMove(server(), NOW);
    expect(file.collections.watchlist[0]).toMatchObject({ symbol: "NVDA", alertAbove: 900, alertBelow: null });
    expect(file.collections.notes[0]).toMatchObject({ kind: "thesis", createdAt: T });
    expect(file.collections.targets[0]).toMatchObject({ profitMin: -10, riskMax: 35 });
    expect(file.collections.alerts[0]).toMatchObject({ refId: "5", dedupeKey: "watch:5:above", read: false });
  });

  it("copies a saved risk profile as the single profile record, and none when nothing was saved", () => {
    expect(planMove(server(), NOW).file.collections.riskProfile[0]).toMatchObject({ id: "me", level: "growth", maxPositionPct: 15, paperMode: false });
    expect(planMove({ ...server(), risk_profile: { ...(server().risk_profile as NonNullable<ServerData["risk_profile"]>), saved: false } }, NOW).counts.riskProfile).toBe(0);
    expect(planMove({ ...server(), risk_profile: null }, NOW).counts.riskProfile).toBe(0);
  });

  it("never moves AI settings", () => {
    expect(planMove(server(), NOW).file.collections.aiSettings).toEqual([]);
  });

  it("plans nothing for a user with no data", () => {
    const empty: ServerData = { accounts: [], holdings: [], watchlist: [], notes: [], targets: [], alerts: [], plans: [], risk_profile: null };
    const plan = planMove(empty, NOW);
    expect(Object.values(plan.counts).every((n) => n === 0)).toBe(true);
    expect(plan.leftBehind).toEqual({ accounts: 0, holdings: 0, plans: 0 });
  });
});

describe("copyToDevice", () => {
  it("writes every planned record and finds them all again", async () => {
    const store = new LocalStore(new MemoryBackend());
    const out = await copyToDevice(store, planMove(server(), NOW));
    expect(out.missing).toEqual([]);
    expect(out.summary.added).toBe(9); // an account, a position, a watch item, a note, a target, an alert, two plans and the profile
    expect((await store.list("holdings")).map((h) => h.symbol)).toEqual(["AAPL"]);
  });

  it("changes nothing when run a second time", async () => {
    const store = new LocalStore(new MemoryBackend());
    const plan = planMove(server(), NOW);
    await copyToDevice(store, plan);
    const again = await copyToDevice(store, plan);
    expect(again.summary.added).toBe(0);
    expect(await store.list("accounts")).toHaveLength(1);
  });

  it("refuses a plan the store's validation rejects, and writes nothing", async () => {
    const store = new LocalStore(new MemoryBackend());
    const bad = planMove(server(), NOW);
    const broken = { ...bad, file: { ...bad.file, collections: { ...bad.file.collections, accounts: [{ ...bad.file.collections.accounts[0], cash: "lots" }] } } };
    await expect(copyToDevice(store, broken as never)).rejects.toThrow();
    expect(await store.list("watchlist")).toEqual([]);
  });
});

describe("the server calls", () => {
  it("fetches the export and deletes with DELETE", async () => {
    mockedApi.mockResolvedValue({});
    await fetchServerData();
    await deleteServerData();
    expect(mockedApi).toHaveBeenNthCalledWith(1, "/me/data");
    expect(mockedApi).toHaveBeenNthCalledWith(2, "/me/data", { method: "DELETE" });
  });
});
