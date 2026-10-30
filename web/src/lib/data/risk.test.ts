import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiWithHeaders, type Portfolio } from "../api";
import { DEFAULT_RULES } from "../calc/profile";
import { LocalStore, MemoryBackend } from "../store";
import { getPortfolio } from "./portfolio";
import { portfolioRiskReport, stressReport } from "./risk";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn(), apiWithHeaders: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
vi.mock("./portfolio", () => ({ getPortfolio: vi.fn(), LOCAL_BOOK: "real" }));
const mockedApi = vi.mocked(api);
const mockedHeaders = vi.mocked(apiWithHeaders);
const mockedPortfolio = vi.mocked(getPortfolio);

const DAY = 86_400;
const T0 = 1_700_000_000 - (1_700_000_000 % DAY);
const bars = (base: number, amp: number, n = 30) =>
  Array.from({ length: n }, (_, i) => ({ t: T0 + i * DAY, c: base * (1 + amp * Math.sin(i * 1.3) + 0.002 * i) }));

function snapshot(values: Record<string, number>, cash: number): Portfolio {
  const holdings = Object.entries(values).map(([symbol, value]) => ({ symbol, value, stale: false }));
  const invested = Object.values(values).reduce((s, v) => s + v, 0);
  return { holdings, totals: { cash, net_worth: invested + cash, unpriced: [] } } as unknown as Portfolio;
}

function candles(series: Record<string, ReturnType<typeof bars>>, source = "finnhub+fmp"): void {
  mockedHeaders.mockImplementation(async (path: string) => {
    const symbol = path.split("/")[2] ?? "";
    const data = series[symbol];
    if (!data) throw new Error(`no candles for ${symbol}`);
    return { data, headers: new Headers({ "X-Data-Source": source }) } as never;
  });
}

const crisisRow = (key: string, drawdown: number | null) => ({ key, name: `Crisis ${key}`, stock: drawdown === null ? null : { drawdown_pct: drawdown } });

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  for (const m of [mockedApi, mockedHeaders, mockedPortfolio]) m.mockReset();
  mockedApi.mockImplementation(async (path: string) => {
    if (path.endsWith("/company")) return { sector: path.includes("AAA") ? "Technology" : "Energy" };
    throw new Error(`unexpected ${path}`);
  });
});

describe("portfolioRiskReport", () => {
  it("computes the risk of the local book from daily bars and the saved (default) rules", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ AAA: 6000, BBB: 2000 }, 2000));
    candles({ AAA: bars(100, 0.02), BBB: bars(50, 0.03), SPY: bars(400, 0.01) });

    const r = await portfolioRiskReport();

    expect(r).toMatchObject({ mode: "real", holdings_count: 2, cash_pct: 20, top_position_pct: 60, sectors: { Technology: 60, Energy: 20 }, data_source: "finnhub+fmp", window_limited_by: null });
    expect(r.days).toBe(29);
    expect(r.volatility_pct).not.toBeNull();
    expect(r.rules.max_position_pct).toBe(DEFAULT_RULES.moderate.max_position_pct);
  });

  it("reports the limits the book is over, worded as the server words them", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ AAA: 6000, BBB: 2000 }, 2000));
    candles({ AAA: bars(100, 0.02), BBB: bars(50, 0.03), SPY: bars(400, 0.01) });
    const r = await portfolioRiskReport();
    expect(r.breaches).toContainEqual({ rule: "position_size", subject: "AAA", message: "AAA is 60.0% of your portfolio — above your 8% limit" });
  });

  it("names the holding that cut the window short when its history is much shorter than the market's", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ AAA: 5000, BBB: 5000 }, 0));
    candles({ AAA: bars(100, 0.02), BBB: bars(50, 0.03, 20), SPY: bars(400, 0.01) });
    expect((await portfolioRiskReport()).window_limited_by).toBe("BBB");
  });

  it("labels the whole report as sample data if any price series is", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ AAA: 5000 }, 0));
    mockedHeaders.mockImplementation(async (path: string) => ({
      data: bars(100, 0.02),
      headers: new Headers({ "X-Data-Source": path.includes("/AAA/") ? "mock-fallback" : "finnhub" }),
    }) as never);
    expect((await portfolioRiskReport()).data_source).toBe("mock-fallback");
  });

  it("fails when prices for a held symbol cannot be fetched", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ AAA: 5000 }, 0));
    candles({ SPY: bars(400, 0.01) });
    await expect(portfolioRiskReport()).rejects.toThrow("no candles for AAA");
  });
});

describe("stressReport", () => {
  const crises = { GFC: [crisisRow("gfc", -50), crisisRow("covid", null)] };

  function respond(own: Record<string, ReturnType<typeof crisisRow>[]>): void {
    mockedApi.mockImplementation(async (path: string) => {
      const symbol = path.split("/")[2] ?? "";
      const rows = own[symbol];
      if (!rows) throw new Error(`unexpected ${path}`);
      return { crises: rows, data_source: "finnhub" };
    });
  }

  it("uses a holding's own fall in a crisis and beta times the market's fall when it was not listed yet", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ AAA: 8000 }, 2000));
    candles({ AAA: bars(100, 0.02), SPY: bars(400, 0.01) });
    respond({ SPY: [crisisRow("gfc", -40), crisisRow("covid", -30)], AAA: crises.GFC });

    const s = await stressReport();

    const byKey = Object.fromEntries(s.scenarios.map((x) => [x.key, x]));
    expect(byKey["gfc"]).toMatchObject({ kind: "historical", change: -4000, change_pct: -40 }); // 8000 * -50%, over 10000
    expect(byKey["covid"]?.worst[0]).toMatchObject({ symbol: "AAA", basis: "estimated from beta" });
    expect(s.scenarios.map((x) => x.key)).toEqual(["gfc", "covid", "market-10", "market-20", "market-35"]);
    expect(s).toMatchObject({ total_value: 10000, loss_limit_pct: -20, mode: "real" });
  });

  it("marks the scenarios that fall past the saved loss limit", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ AAA: 8000 }, 2000));
    candles({ AAA: bars(100, 0.02), SPY: bars(400, 0.01) });
    respond({ SPY: [crisisRow("gfc", -40), crisisRow("covid", -30)], AAA: crises.GFC });
    const s = await stressReport();
    expect(Object.fromEntries(s.scenarios.map((x) => [x.key, x.breaches_limit]))).toMatchObject({ gfc: true, "market-10": false });
  });

  it("takes the benchmark's own crisis history when the benchmark is a holding, without a second request", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({ SPY: 10000 }, 0));
    candles({ SPY: bars(400, 0.01) });
    respond({ SPY: [crisisRow("gfc", -40)] });
    const s = await stressReport();
    expect(s.scenarios[0]).toMatchObject({ key: "gfc", change: -4000 });
    expect(mockedApi.mock.calls.filter(([path]) => String(path).includes("/crises"))).toHaveLength(1);
  });

  it("lists the crises with no loss for an empty book", async () => {
    mockedPortfolio.mockResolvedValue(snapshot({}, 500));
    candles({ SPY: bars(400, 0.01) });
    respond({ SPY: [crisisRow("gfc", -40)] });
    const s = await stressReport();
    expect(s.scenarios.every((x) => x.change === 0)).toBe(true);
    expect(s.total_value).toBe(500);
  });
});
