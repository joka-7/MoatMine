import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiWithHeaders, type Evaluation, type Portfolio } from "../api";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { listAlerts, markAllRead, runAlertPass } from "./alerts";
import { getPortfolio } from "./portfolio";
import { saveProfile } from "./riskProfile";
import { evaluateTargets } from "./targets";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn(), apiWithHeaders: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
vi.mock("./portfolio", () => ({ getPortfolio: vi.fn(), LOCAL_BOOK: "real" }));
vi.mock("./targets", () => ({ evaluateTargets: vi.fn() }));
const mockedApi = vi.mocked(api);
const mockedHeaders = vi.mocked(apiWithHeaders);

const DAY = 86_400;
const T0 = Math.floor(Date.now() / 1000 / DAY) * DAY - 60 * DAY;
const bar = (i: number, c: number) => ({ t: T0 + i * DAY, c });

function book(values: Record<string, number>, cash: number): Portfolio {
  const holdings = Object.entries(values).map(([symbol, value]) => ({ id: `h-${symbol}`, symbol, value, stale: false }));
  const invested = Object.values(values).reduce((s, v) => s + v, 0);
  return { holdings, totals: { cash, net_worth: invested + cash, unpriced: [] } } as unknown as Portfolio;
}

async function hold(symbol: string, quantity = 10): Promise<void> {
  await store.put("holdings", { id: `h-${symbol}`, accountId: "acc1", symbol, quantity, avgCost: 1, openedAt: "2026-01-01T00:00:00.000Z" });
}

function prices(quotes: Record<string, number>): void {
  mockedApi.mockImplementation(async (path: string) => {
    if (path.endsWith("/company")) return { sector: "Technology" };
    const symbol = path.split("/")[2] ?? "";
    const price = quotes[symbol];
    if (price === undefined) throw new Error("no price");
    return { price };
  });
}

const alerts = async () => (await listAlerts(true)).map((a) => [a.source, a.message]);

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  for (const m of [mockedApi, mockedHeaders, vi.mocked(getPortfolio), vi.mocked(evaluateTargets)]) m.mockReset();
  window.localStorage.clear();
  setLocalMode(true);
  vi.mocked(evaluateTargets).mockResolvedValue([]);
  vi.mocked(getPortfolio).mockResolvedValue(book({}, 0));
});

const watch = (symbol: string, alertAbove: number | null, alertBelow: number | null) =>
  store.put("watchlist", { id: `w-${symbol}`, symbol, note: "", alertAbove, alertBelow, createdAt: "2026-01-01T00:00:00.000Z" });

describe("runAlertPass: watchlist", () => {
  it("raises an alert when the price is at or past a threshold, worded as the server words it", async () => {
    await watch("AAA", 150, null);
    await watch("BBB", null, 20);
    prices({ AAA: 150, BBB: 20 });
    expect(await runAlertPass()).toEqual({ created: 2, skipped: [] });
    expect(await alerts()).toEqual(expect.arrayContaining([["watch", "AAA at 150.0 ≥ 150.0"], ["watch", "BBB at 20.0 ≤ 20.0"]]));
  });

  it("raises nothing while the price is inside the thresholds", async () => {
    await watch("AAA", 150, 100);
    prices({ AAA: 120 });
    expect((await runAlertPass()).created).toBe(0);
  });

  it("raises one alert per condition until it is read, then again", async () => {
    await watch("AAA", 150, null);
    prices({ AAA: 160 });
    expect((await runAlertPass()).created).toBe(1);
    expect((await runAlertPass()).created).toBe(0);
    await markAllRead();
    expect((await runAlertPass()).created).toBe(1);
    expect(await listAlerts(true)).toHaveLength(2);
  });

  it("leaves a symbol with no price for the next pass", async () => {
    await watch("AAA", 150, null);
    prices({});
    expect((await runAlertPass()).created).toBe(0);
  });
});

describe("runAlertPass: targets", () => {
  it("raises an alert for each breached dimension of a target", async () => {
    vi.mocked(evaluateTargets).mockResolvedValue([{
      target_id: "t1", name: "Guard", symbol: null, breaches: ["amount"],
      checks: { amount: { value: 1850, target: null, min: null, max: 1500, status: "above_max", progress_pct: null } },
    } as unknown as Evaluation]);
    await store.put("targets", {
      id: "t1", name: "Guard", symbol: null, profitTarget: null, profitMin: null, profitMax: null, amountTarget: null, amountMin: null, amountMax: 1500,
      periodTargetDays: null, periodMinDays: null, periodMaxDays: null, intent: "growth", intentNote: "", riskTarget: null, riskMin: null, riskMax: null, createdAt: "2026-01-01T00:00:00.000Z",
    });
    prices({});
    await runAlertPass();
    expect(await alerts()).toEqual([["target", "[Guard] portfolio amount 1850.0 is above max (1500.0)"]]);
  });
});

describe("runAlertPass: risk rules", () => {
  it("does nothing about concentration until a risk profile is saved", async () => {
    vi.mocked(getPortfolio).mockResolvedValue(book({ AAA: 9000 }, 1000));
    await hold("AAA");
    prices({});
    expect((await runAlertPass()).created).toBe(0);
  });

  it("raises a concentration alert once a profile is saved", async () => {
    await saveProfile({ level: "moderate", paper_mode: true }); // 8% position limit
    vi.mocked(getPortfolio).mockResolvedValue(book({ AAA: 9000 }, 1000));
    await hold("AAA");
    prices({});
    mockedHeaders.mockResolvedValue({ data: [bar(0, 100), bar(1, 100)], headers: new Headers({ "X-Data-Source": "finnhub" }) } as never);
    await runAlertPass();
    expect((await listAlerts(true)).map((a) => a.message)).toContain("AAA is 90.0% of your portfolio — above your 8% limit");
  });

  it("raises a loss-limit alert when the book has fallen past the limit from its peak", async () => {
    await saveProfile({ level: "moderate", paper_mode: true, max_position_pct: 100, max_sector_pct: 100 }); // loss limit -20
    vi.mocked(getPortfolio).mockResolvedValue(book({ AAA: 1000 }, 0));
    await hold("AAA");
    prices({});
    mockedHeaders.mockResolvedValue({ data: [bar(0, 100), bar(1, 120), bar(2, 90)], headers: new Headers({ "X-Data-Source": "finnhub" }) } as never);
    await runAlertPass();
    expect((await listAlerts(true)).map((a) => a.message)).toContain("Your holdings are 25.0% below their 1-year high — past your 20% loss limit");
  });

  it("skips the loss limit, and says so, when only sample prices exist", async () => {
    await saveProfile({ level: "moderate", paper_mode: true, max_position_pct: 100, max_sector_pct: 100 });
    vi.mocked(getPortfolio).mockResolvedValue(book({ AAA: 1000 }, 0));
    await hold("AAA");
    prices({});
    mockedHeaders.mockResolvedValue({ data: [bar(0, 100), bar(1, 120), bar(2, 50)], headers: new Headers({ "X-Data-Source": "mock-fallback" }) } as never);
    const out = await runAlertPass();
    expect(out.skipped).toEqual(["loss limit: only sample prices are available"]);
    expect(await alerts()).toEqual([]);
  });

  it("still raises the other alerts, and says why, when the price history cannot be fetched", async () => {
    await saveProfile({ level: "moderate", paper_mode: true });
    vi.mocked(getPortfolio).mockResolvedValue(book({ AAA: 9000 }, 1000));
    await hold("AAA");
    prices({});
    mockedHeaders.mockRejectedValue(new Error("history down"));
    const out = await runAlertPass();
    expect(out.skipped).toEqual(["loss limit: history down"]);
    expect(out.created).toBe(2); // the position and the sector are both over their limits
  });
});

describe("listAlerts and markAllRead", () => {
  it("asks the server when not local, and posts read-all", async () => {
    setLocalMode(false);
    mockedApi.mockResolvedValue([]);
    await listAlerts(false);
    await markAllRead();
    expect(mockedApi).toHaveBeenNthCalledWith(1, "/alerts");
    expect(mockedApi).toHaveBeenNthCalledWith(2, "/alerts/read-all", { method: "POST" });
  });

  it("lists local alerts newest first and marks them all read", async () => {
    await store.put("alerts", { id: "a1", source: "watch", refId: "w", symbol: "AAA", message: "old", dedupeKey: "k1", read: false, createdAt: "2026-01-01T00:00:00.000Z" });
    await store.put("alerts", { id: "a2", source: "watch", refId: "w", symbol: "AAA", message: "new", dedupeKey: "k2", read: false, createdAt: "2026-02-01T00:00:00.000Z" });
    expect((await listAlerts(true)).map((a) => a.message)).toEqual(["new", "old"]);
    await markAllRead();
    expect((await listAlerts(true)).every((a) => a.read)).toBe(true);
  });
});
