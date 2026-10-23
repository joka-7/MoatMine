import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { addAccount, addHolding, getPortfolio, listAccounts, removeAccount, removeHolding } from "./portfolio";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
const mockedApi = vi.mocked(api);

const account = { name: "Main", broker: "manual", currency: "USD", cash: 500 };
const quoteFor = (prices: Record<string, number>) => async (path: string) => {
  const symbol = path.split("/")[2] ?? "";
  const price = prices[symbol];
  if (price === undefined) throw new Error("no price");
  return { price, change: 1, change_pct: 1 };
};

async function onlyId(collection: "accounts" | "holdings"): Promise<string> {
  const [record] = await store.list(collection);
  if (!record) throw new Error(`no ${collection}`);
  return record.id;
}

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  mockedApi.mockReset();
  window.localStorage.clear();
});

describe("addAccount", () => {
  it("posts to the server when local mode is off", async () => {
    await addAccount(account);
    expect(mockedApi).toHaveBeenCalledWith("/accounts", { method: "POST", json: account });
  });

  it("keeps a real-money account on the device when local mode is on", async () => {
    setLocalMode(true);
    await addAccount(account);
    expect(mockedApi).not.toHaveBeenCalled();
    expect(await listAccounts(true)).toMatchObject([{ name: "Main", cash: 500 }]);
  });

  it("refuses a paper account on the device", async () => {
    setLocalMode(true);
    await expect(addAccount({ ...account, broker: "paper" })).rejects.toThrow("Paper accounts");
  });
});

describe("addHolding and getPortfolio", () => {
  it("values local positions with quotes fetched by symbol, listing a symbol without a price as unpriced", async () => {
    setLocalMode(true);
    await addAccount(account);
    const accountId = await onlyId("accounts");
    await addHolding({ account_id: accountId, symbol: "aaa", quantity: 10, avg_cost: 100 });
    await addHolding({ account_id: accountId, symbol: "BBB", quantity: 5, avg_cost: 40 });
    mockedApi.mockImplementation(quoteFor({ AAA: 120 }));

    const p = await getPortfolio("real", true);

    expect(mockedApi.mock.calls.map(([path]) => path).sort()).toEqual(["/stocks/AAA/quote", "/stocks/BBB/quote"]);
    expect(p.totals).toMatchObject({ cash: 500, invested_value: 1400, net_worth: 1900, unpriced: ["BBB"] });
    expect(p.holdings.map((h) => h.symbol)).toEqual(["AAA", "BBB"]);
  });

  it("returns no check for a position recorded on the device", async () => {
    setLocalMode(true);
    await addAccount(account);
    expect(await addHolding({ account_id: await onlyId("accounts"), symbol: "AAA", quantity: 1, avg_cost: 1 })).toEqual({ check: null });
  });

  it("rejects a position for an account that is not on the device", async () => {
    setLocalMode(true);
    await expect(addHolding({ account_id: "missing", symbol: "AAA", quantity: 1, avg_cost: 1 })).rejects.toThrow("no longer exists");
  });

  it("asks the server for the chosen book when not local", async () => {
    mockedApi.mockResolvedValueOnce({ mode: "paper" });
    await getPortfolio("paper", false);
    expect(mockedApi).toHaveBeenCalledWith("/portfolio?mode=paper");
  });
});

describe("removeAccount and removeHolding", () => {
  it("delete on the server when local mode is off", async () => {
    await removeAccount(3);
    await removeHolding(4);
    expect(mockedApi).toHaveBeenCalledWith("/accounts/3", { method: "DELETE" });
    expect(mockedApi).toHaveBeenCalledWith("/holdings/4", { method: "DELETE" });
  });

  it("removing a local account removes its positions too", async () => {
    setLocalMode(true);
    await addAccount(account);
    await addHolding({ account_id: await onlyId("accounts"), symbol: "AAA", quantity: 1, avg_cost: 1 });
    await removeAccount(await onlyId("accounts"));
    expect(await store.list("accounts")).toEqual([]);
    expect(await store.list("holdings")).toEqual([]);
  });

  it("removing a local position keeps the account", async () => {
    setLocalMode(true);
    await addAccount(account);
    await addHolding({ account_id: await onlyId("accounts"), symbol: "AAA", quantity: 1, avg_cost: 1 });
    await removeHolding(await onlyId("holdings"));
    expect(await store.list("holdings")).toEqual([]);
    expect(await store.list("accounts")).toHaveLength(1);
  });
});
