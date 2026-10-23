import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiWithHeaders } from "../api";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { addAccount, addHolding } from "./portfolio";
import { evaluateTargets, listTargets, removeTarget, saveTarget, type TargetInput } from "./targets";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn(), apiWithHeaders: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
const mockedApi = vi.mocked(api);
const mockedHeaders = vi.mocked(apiWithHeaders);

const target = (changes: Partial<TargetInput> = {}): TargetInput => ({
  name: "Growth", symbol: null, profit_target: null, profit_min: null, profit_max: null,
  amount_target: null, amount_min: null, amount_max: null, period_target_days: null, period_min_days: null, period_max_days: null,
  intent: "growth", intent_note: "", risk_target: null, risk_min: null, risk_max: null, ...changes,
});

async function onlyId(collection: "accounts" | "targets"): Promise<string> {
  const [record] = await store.list(collection);
  if (!record) throw new Error(`no ${collection}`);
  return record.id;
}

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  mockedApi.mockReset();
  mockedHeaders.mockReset();
  window.localStorage.clear();
});

describe("saveTarget", () => {
  it("posts a new target and puts a changed one when local mode is off", async () => {
    await saveTarget(target(), null);
    await saveTarget(target(), 5);
    expect(mockedApi).toHaveBeenNthCalledWith(1, "/targets", { method: "POST", json: target() });
    expect(mockedApi).toHaveBeenNthCalledWith(2, "/targets/5", { method: "PUT", json: target() });
  });

  it("stores a target on the device and replaces it when saved again with its id", async () => {
    setLocalMode(true);
    await saveTarget(target({ profit_min: -10, symbol: " aapl " }), null);
    const id = await onlyId("targets");
    await saveTarget(target({ name: "Renamed" }), id);
    expect(mockedApi).not.toHaveBeenCalled();
    const listed = await listTargets(true);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id, name: "Renamed", symbol: null, profit_min: null });
  });

  it("upper-cases the symbol", async () => {
    setLocalMode(true);
    await saveTarget(target({ symbol: " aapl " }), null);
    expect((await listTargets(true))[0]?.symbol).toBe("AAPL");
  });

  it.each([
    ["profit", { profit_min: 5, profit_max: 1 }],
    ["amount", { amount_min: 5, amount_max: 1 }],
    ["period", { period_min_days: 5, period_max_days: 1 }],
    ["risk", { risk_min: 5, risk_max: 1 }],
  ])("rejects a %s minimum above its maximum", async (dim, changes) => {
    setLocalMode(true);
    await expect(saveTarget(target(changes), null)).rejects.toThrow(`${dim}: min must be <= max`);
    expect(await store.list("targets")).toEqual([]);
  });

  it("rejects a blank name", async () => {
    setLocalMode(true);
    await expect(saveTarget(target({ name: "  " }), null)).rejects.toThrow("needs a name");
  });
});

describe("removeTarget", () => {
  it("deletes on the server when local mode is off", async () => {
    await removeTarget(2);
    expect(mockedApi).toHaveBeenCalledWith("/targets/2", { method: "DELETE" });
  });

  it("removes the local target when local mode is on", async () => {
    setLocalMode(true);
    await saveTarget(target(), null);
    await removeTarget(await onlyId("targets"));
    expect(await listTargets(true)).toEqual([]);
  });
});

describe("evaluateTargets", () => {
  it("asks the server when not local", async () => {
    mockedApi.mockResolvedValueOnce([]);
    expect(await evaluateTargets(false)).toEqual([]);
    expect(mockedApi).toHaveBeenCalledWith("/targets/evaluate");
  });

  async function holdAaa(): Promise<void> {
    setLocalMode(true);
    await addAccount({ name: "Main", broker: "manual", currency: "USD", cash: 0 });
    await addHolding({ account_id: await onlyId("accounts"), symbol: "AAA", quantity: 10, avg_cost: 100 });
    mockedApi.mockResolvedValue({ price: 80, change: 0, change_pct: 0 });
  }

  it("evaluates local targets against the local portfolio and flags a breach", async () => {
    await holdAaa();
    mockedHeaders.mockResolvedValue({ data: [{ c: 100 }, { c: 110 }, { c: 99 }, { c: 108.9 }, { c: 98.01 }], headers: new Headers({ "X-Data-Source": "finnhub" }) });
    await saveTarget(target({ profit_min: -10, intent: "growth", risk_max: 100 }), null);

    const [e] = await evaluateTargets(true);

    expect(e?.checks.profit).toMatchObject({ value: -20, status: "below_min" });
    expect(e?.checks.intent).toMatchObject({ value: 158.75, status: "above_max" });
    expect(e?.breaches).toEqual(["profit", "intent"]);
  });

  it("treats a symbol with only sample prices, or a failed price fetch, as unknown risk", async () => {
    await holdAaa();
    mockedHeaders.mockResolvedValue({ data: [{ c: 1 }, { c: 2 }, { c: 1 }], headers: new Headers({ "X-Data-Source": "mock-fallback" }) });
    await saveTarget(target({ risk_max: 10 }), null);
    expect((await evaluateTargets(true))[0]?.checks.intent.status).toBe("no_data");

    mockedHeaders.mockRejectedValue(new Error("down"));
    expect((await evaluateTargets(true))[0]?.checks.intent.status).toBe("no_data");
  });
});
