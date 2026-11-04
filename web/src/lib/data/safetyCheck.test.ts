import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Portfolio } from "../api";
import { LocalStore, MemoryBackend } from "../store";
import { saveProfile } from "./riskProfile";
import { checkOnDevice } from "./safetyCheck";
import { setLocalMode } from "../localMode";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
const mockedApi = vi.mocked(api);

const holding = (symbol: string, value: number) => ({ symbol, value, stale: false });
const snapshot = (holdings: ReturnType<typeof holding>[], cash: number, unpriced: string[] = []) =>
  ({ holdings, totals: { cash, net_worth: holdings.reduce((s, h) => s + h.value, cash), unpriced } }) as unknown as Portfolio;

const report = (changes: Record<string, unknown> = {}) => ({
  score: 75, grade: "B", flags: [], sector: "Technology",
  facts: { price: 100, fair_value: 110, market_cap_m: 50000, volatility_pct: 20 }, ...changes,
});

function respond(routes: Record<string, unknown>): void {
  mockedApi.mockImplementation(async (path: string) => {
    const hit = Object.entries(routes).find(([prefix]) => path.startsWith(prefix));
    if (!hit) throw new Error(`unexpected ${path}`);
    if (hit[1] instanceof Error) throw hit[1];
    return hit[1];
  });
}

beforeEach(async () => {
  store = new LocalStore(new MemoryBackend());
  mockedApi.mockReset();
  window.localStorage.clear();
  setLocalMode(true);
  await saveProfile({ level: "moderate", paper_mode: true }); // 8% position, 25% sector, minimum score 60
});

describe("checkOnDevice", () => {
  it("passes a small buy and carries the stock's score, grade and flags", async () => {
    respond({ "/stocks/AAA/safety": report(), "/stocks/BBB/company": { sector: "Energy" } });
    const out = await checkOnDevice("AAA", 500, snapshot([holding("BBB", 5000)], 5000));
    expect(out).toMatchObject({ verdict: "pass", mode: "real", symbol: "AAA", safety: { score: 75, grade: "B", flags: [] } });
  });

  it("blocks a buy that would make one position too large for the saved rules", async () => {
    respond({ "/stocks/AAA/safety": report(), "/stocks/BBB/company": { sector: "Energy" } });
    const out = await checkOnDevice("AAA", 3000, snapshot([holding("BBB", 5000)], 5000));
    expect(out.verdict).toBe("block");
    expect(out.checks.find((c) => c.rule === "position_size")?.message).toContain("AAA would be 30.0% of your portfolio");
  });

  it("sizes the sector from the sector of each existing holding, falling back to industry", async () => {
    respond({ "/stocks/AAA/safety": report(), "/stocks/BBB/company": { industry: "Technology" } });
    const out = await checkOnDevice("AAA", 500, snapshot([holding("BBB", 2000)], 8000));
    expect(out.checks.find((c) => c.rule === "sector")?.message).toContain("Technology would be 25.0%");
  });

  it("treats a holding whose company lookup fails as Unknown rather than failing the check", async () => {
    respond({ "/stocks/AAA/safety": report(), "/stocks/BBB/company": new Error("down") });
    const out = await checkOnDevice("AAA", 500, snapshot([holding("BBB", 5000)], 5000));
    expect(out.verdict).toBe("pass");
  });

  it("warns about holdings with no live price", async () => {
    respond({ "/stocks/AAA/safety": report(), "/stocks/BBB/company": { sector: "Energy" } });
    const out = await checkOnDevice("AAA", 500, snapshot([holding("BBB", 5000)], 5000, ["BBB"]));
    expect(out.verdict).toBe("warn");
    expect(out.checks.find((c) => c.rule === "prices")?.message).toContain("BBB");
  });

  it("fails when the stock's own report cannot be fetched", async () => {
    respond({ "/stocks/AAA/safety": new Error("no report") });
    await expect(checkOnDevice("AAA", 500, snapshot([], 1000))).rejects.toThrow("no report");
  });
});
