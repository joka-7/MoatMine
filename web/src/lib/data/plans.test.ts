import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type BuyPlan, type CheckResult, type Portfolio } from "../api";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { getPortfolio } from "./portfolio";
import { cancelPlan, checkQuantity, createPlan, executePlan, listPlans } from "./plans";
import { checkOnDevice } from "./safetyCheck";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
vi.mock("./portfolio", () => ({ getPortfolio: vi.fn(), LOCAL_BOOK: "real" }));
vi.mock("./safetyCheck", () => ({ checkOnDevice: vi.fn() }));
const mockedApi = vi.mocked(api);
const mockedCheck = vi.mocked(checkOnDevice);

const NOW = new Date("2026-03-02T12:00:00.000Z");
const LONG_NOTE = "Strong moat and I can live with the swings.";

const verdictOf = (verdict: "pass" | "warn" | "block", hours = 0): CheckResult =>
  ({ symbol: "AAA", amount: 1000, verdict, risky: verdict !== "pass", requires_note: verdict === "warn", cooling_off_hours: verdict === "warn" ? hours : 0, checks: [], safety: { score: 70, grade: "B", flags: [] } }) as unknown as CheckResult;

async function accountId(): Promise<string> {
  const [a] = await store.list("accounts");
  if (a) return a.id;
  return (await store.put("accounts", { id: "acc1", name: "Main", broker: "manual", currency: "USD", cash: 0, createdAt: NOW.toISOString() })).id;
}

async function plan(note = ""): Promise<BuyPlan> {
  return createPlan({ account_id: await accountId(), symbol: "aaa", quantity: 10, note });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  store = new LocalStore(new MemoryBackend());
  for (const m of [mockedApi, mockedCheck, vi.mocked(getPortfolio)]) m.mockReset();
  window.localStorage.clear();
  setLocalMode(true);
  mockedApi.mockResolvedValue({ price: 100 });
  vi.mocked(getPortfolio).mockResolvedValue({} as Portfolio);
});

afterEach(() => vi.useRealTimers());

describe("createPlan", () => {
  it("posts to the server when local mode is off", async () => {
    setLocalMode(false);
    await createPlan({ account_id: 1, symbol: "AAA", quantity: 1, note: "" });
    expect(mockedApi).toHaveBeenCalledWith("/plans", { method: "POST", json: { account_id: 1, symbol: "AAA", quantity: 1, note: "" } });
  });

  it("is ready at once when the check passes, priced at the live quote", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    expect(await plan()).toMatchObject({ status: "ready", price: 100, amount: 1000, symbol: "AAA", verdict: "pass" });
  });

  it("is blocked when the check blocks", async () => {
    mockedCheck.mockResolvedValue(verdictOf("block"));
    expect(await plan()).toMatchObject({ status: "blocked" });
  });

  it("cools off for the profile's hours when the check warns and a reason is written", async () => {
    mockedCheck.mockResolvedValue(verdictOf("warn", 24));
    const p = await plan(LONG_NOTE);
    expect(p).toMatchObject({ status: "cooling_off", available_at: "2026-03-03T12:00:00.000Z" });
  });

  it("is ready at once when the check warns but the profile has no cooling-off", async () => {
    mockedCheck.mockResolvedValue(verdictOf("warn", 0));
    expect(await plan(LONG_NOTE)).toMatchObject({ status: "ready" });
  });

  it("refuses a risky buy without a written reason of 20 or more characters, and saves nothing", async () => {
    mockedCheck.mockResolvedValue(verdictOf("warn", 24));
    await expect(plan("too short")).rejects.toThrow("Write why you still want it (20+ characters)");
    expect(await store.list("plans")).toEqual([]);
  });

  it("rejects an account that is not on the device", async () => {
    await expect(createPlan({ account_id: "missing", symbol: "AAA", quantity: 1, note: "" })).rejects.toThrow("account not found");
  });
});

describe("listPlans", () => {
  it("shows a cooling-off plan as ready once its wait is over, newest first", async () => {
    mockedCheck.mockResolvedValue(verdictOf("warn", 24));
    await plan(LONG_NOTE);
    vi.setSystemTime(new Date(NOW.getTime() + 25 * 3_600_000));
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const second = await plan();
    const listed = await listPlans(true);
    expect(listed.map((p) => p.status)).toEqual(["ready", "ready"]);
    expect(listed[0]?.id).toBe(second.id);
  });
});

describe("executePlan", () => {
  it("records the position at the live price and a thesis note, and marks the plan executed", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan(LONG_NOTE);
    mockedApi.mockResolvedValue({ price: 102.5 });

    const done = await executePlan(p.id);

    expect(done).toMatchObject({ status: "executed", price: 102.5 });
    expect(await store.list("holdings")).toMatchObject([{ symbol: "AAA", quantity: 10, avgCost: 102.5, accountId: "acc1" }]);
    expect(await store.list("notes")).toMatchObject([{ symbol: "AAA", kind: "thesis", title: "Why I bought (10 @ 102.50)", body: LONG_NOTE }]);
  });

  it("refuses a plan that is still cooling off, naming when it can run", async () => {
    mockedCheck.mockResolvedValue(verdictOf("warn", 24));
    const p = await plan(LONG_NOTE);
    await expect(executePlan(p.id)).rejects.toThrow("plan is cooling_off until 2026-03-03T12:00:00.000Z");
  });

  it("blocks the plan when the rules no longer allow the buy, and records no position", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan();
    mockedCheck.mockResolvedValue(verdictOf("block"));
    await expect(executePlan(p.id)).rejects.toThrow("no longer passes your rules");
    expect((await listPlans(true))[0]?.status).toBe("blocked");
    expect(await store.list("holdings")).toEqual([]);
  });

  it("cancels a plan approved as pass that now warns, if it has no written reason", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan();
    mockedCheck.mockResolvedValue(verdictOf("warn", 24));
    await expect(executePlan(p.id)).rejects.toThrow("Make a new plan and write why");
    expect((await listPlans(true))[0]?.status).toBe("cancelled");
  });

  it("sends a plan approved as pass that now warns back to cooling off when it has a reason", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan(LONG_NOTE);
    mockedCheck.mockResolvedValue(verdictOf("warn", 12));
    await expect(executePlan(p.id)).rejects.toThrow("waits 12h before it can run");
    expect((await listPlans(true))[0]).toMatchObject({ status: "cooling_off", verdict: "warn" });
    expect(await store.list("holdings")).toEqual([]);
  });

  it("releases the claim, so the plan stays ready, when something else fails mid-way", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan();
    mockedApi.mockRejectedValue(new Error("quote service down"));
    await expect(executePlan(p.id)).rejects.toThrow("quote service down");
    expect((await listPlans(true))[0]?.status).toBe("ready");
  });

  it("will not run a plan twice", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan();
    await executePlan(p.id);
    await expect(executePlan(p.id)).rejects.toThrow("plan is executed");
    expect(await store.list("holdings")).toHaveLength(1);
  });
});

describe("cancelPlan", () => {
  it("cancels a plan that has not run", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan();
    expect(await cancelPlan(p.id)).toMatchObject({ status: "cancelled" });
  });

  it("refuses to cancel an executed plan", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const p = await plan();
    await executePlan(p.id);
    await expect(cancelPlan(p.id)).rejects.toThrow("already executed");
  });
});

describe("checkQuantity", () => {
  it("asks the server for the chosen book when not local", async () => {
    await checkQuantity("AAA", 3, true, false);
    expect(mockedApi).toHaveBeenCalledWith("/safety/check", { method: "POST", json: { symbol: "AAA", quantity: 3, mode: "paper" } });
  });

  it("sizes the buy at the live price on the device and reports that price", async () => {
    mockedCheck.mockResolvedValue(verdictOf("pass"));
    const out = await checkQuantity("AAA", 3, false, true);
    expect(mockedCheck).toHaveBeenCalledWith("AAA", 300, expect.anything());
    expect(out).toMatchObject({ price: 100, verdict: "pass" });
  });
});
