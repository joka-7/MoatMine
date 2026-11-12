import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { deviceTools, userNamed } from "./deviceTools";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
const mockedApi = vi.mocked(api);

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  mockedApi.mockReset();
  window.localStorage.clear();
  setLocalMode(true);
});

function tool(name: string, userSaid = "") {
  const found = deviceTools(userSaid).find((t) => t.spec.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
}

describe("userNamed", () => {
  // The same cases as the server's test_user_named (backend/tests/test_tools.py).
  it.each([
    ["AAPL", "buy aapl?", true],
    ["BRK.B", "and BRK.B", true],
    ["AAPL", "AAPLX", false],
    ["", "anything", false],
    ["IT", "is it a good time to buy?", false],
    ["A", "is it a good time to buy?", false],
    ["ON", "carry on", false],
    ["IT", "watch IT for me", true],
    ["IT", "watch $it for me", true],
    ["ALL", "add ALL", true],
  ])("%s in %j → %s", (symbol, text, named) => {
    expect(userNamed(symbol, text)).toBe(named);
  });
});

describe("deviceTools", () => {
  it("offers the same 21 tools as the server", () => {
    expect(deviceTools("").map((t) => t.spec.name)).toEqual([
      "get_portfolio", "get_quote", "get_ratios", "get_news", "get_company", "get_earnings", "get_analysts",
      "get_dividends", "get_valuation", "get_bad_times", "get_risk_profile", "get_safety_score", "safety_check",
      "get_portfolio_risk", "get_stress_test", "get_news_feed", "get_targets_status", "get_watchlist", "get_notes",
      "add_to_watchlist", "save_note",
    ]);
  });

  it.each([
    ["get_quote", { symbol: "aapl" }, "/stocks/AAPL/quote"],
    ["get_safety_score", { symbol: "MSFT" }, "/stocks/MSFT/safety"],
    ["get_bad_times", { symbol: "KO" }, "/stocks/KO/crises"],
    ["get_valuation", { symbol: "KO", discount_rate: 8, growth_rate: "x" }, "/stocks/KO/valuation?discount_rate=8"],
    ["get_portfolio_risk", { mode: "paper" }, "/safety/portfolio?mode=paper"],
  ])("%s asks the server only by symbol or for the paper book", async (name, args, path) => {
    mockedApi.mockResolvedValue({});

    await tool(name).run(args);

    expect(mockedApi).toHaveBeenCalledWith(path);
  });

  it("reads the watchlist from the device, sending the server only the symbol for a quote", async () => {
    await store.put("watchlist", { id: "w", symbol: "KO", note: "dividends", alertAbove: null, alertBelow: null, createdAt: "2026-01-01T00:00:00.000Z" });
    mockedApi.mockResolvedValue({ price: 60 });

    const out = JSON.parse(await tool("get_watchlist").run({}));

    expect(out).toMatchObject([{ symbol: "KO", note: "dividends", quote: { price: 60 } }]);
    expect(mockedApi.mock.calls).toEqual([["/stocks/KO/quote"]]);
  });

  it.each([
    ["the user named the symbol", "please watch MSFT", true],
    ["only the model chose it", "anything interesting today?", false],
  ])("add_to_watchlist writes to the device only when %s", async (_case, userSaid, written) => {
    const out = JSON.parse(await tool("add_to_watchlist", userSaid).run({ symbol: "msft" }));

    expect((await store.list("watchlist")).map((w) => w.symbol)).toEqual(written ? ["MSFT"] : []);
    expect("error" in out).toBe(!written);
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("refuses a non-positive amount in safety_check before checking anything", async () => {
    await expect(tool("safety_check").run({ symbol: "KO", amount: -5000 })).rejects.toThrow("positive");
  });
});
