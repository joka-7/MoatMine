import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { addWatch, listWatch, removeWatch } from "./watchlist";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
const mockedApi = vi.mocked(api);

const input = (symbol: string) => ({ symbol, note: "why", alert_above: 200, alert_below: null });

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  mockedApi.mockReset();
  window.localStorage.clear();
});

describe("addWatch", () => {
  it("posts to the server when local mode is off", async () => {
    await addWatch(input("AAPL"));
    expect(mockedApi).toHaveBeenCalledWith("/watchlist", { method: "POST", json: input("AAPL") });
    expect(await store.list("watchlist")).toEqual([]);
  });

  it("stores the symbol upper-cased on the device, with no server call, when local mode is on", async () => {
    setLocalMode(true);
    await addWatch(input(" aapl "));
    expect(mockedApi).not.toHaveBeenCalled();
    expect(await store.list("watchlist")).toMatchObject([{ symbol: "AAPL", note: "why", alertAbove: 200, alertBelow: null }]);
  });

  it("rejects a symbol that is already on the local watchlist", async () => {
    setLocalMode(true);
    await addWatch(input("AAPL"));
    await expect(addWatch(input("aapl"))).rejects.toThrow("AAPL already on watchlist");
  });
});

describe("listWatch", () => {
  it("returns the server's rows as they are when not local", async () => {
    mockedApi.mockResolvedValueOnce([{ id: 1, symbol: "AAPL" }]);
    expect(await listWatch(false)).toEqual([{ id: 1, symbol: "AAPL" }]);
    expect(mockedApi).toHaveBeenCalledWith("/watchlist");
  });

  it("lists local symbols alphabetically with a quote each, and null for a symbol with no price", async () => {
    setLocalMode(true);
    await addWatch(input("MSFT"));
    await addWatch(input("AAPL"));
    mockedApi.mockImplementation(async (path: string) => {
      if (path.includes("MSFT")) throw new Error("no price");
      return { price: 190 };
    });
    const rows = await listWatch(true);
    expect(rows.map((r) => [r.symbol, r.quote])).toEqual([["AAPL", { price: 190 }], ["MSFT", null]]);
    expect(rows[0]).toMatchObject({ note: "why", alert_above: 200, alert_below: null });
  });
});

describe("removeWatch", () => {
  it("deletes on the server when local mode is off", async () => {
    await removeWatch(7);
    expect(mockedApi).toHaveBeenCalledWith("/watchlist/7", { method: "DELETE" });
  });

  it("removes the local record when local mode is on", async () => {
    setLocalMode(true);
    await addWatch(input("AAPL"));
    const [row] = await store.list("watchlist");
    if (!row) throw new Error("expected a record");
    await removeWatch(row.id);
    expect(await store.list("watchlist")).toEqual([]);
  });
});
