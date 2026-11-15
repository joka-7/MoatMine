import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { describeCompany, loadCustom, MAX_CUSTOM, saveCustom, UNKNOWN, withEntry } from "./custom";
import type { UniverseEntry } from "./universe";

vi.mock("../api", () => ({ api: vi.fn() }));
const mockedApi = vi.mocked(api);

const entry = (symbol: string, changes: Partial<UniverseEntry> = {}): UniverseEntry =>
  ({ symbol, name: symbol, sector: "Technology", industry: "Software", country: "United States", ...changes });

beforeEach(() => {
  window.localStorage.clear();
  mockedApi.mockReset();
});
afterEach(() => window.localStorage.clear());

describe("loadCustom and saveCustom", () => {
  it("keep the user's additions across a reload", () => {
    saveCustom([entry("ZZZ1"), entry("ZZZ2")]);
    expect(loadCustom().map((e) => e.symbol)).toEqual(["ZZZ1", "ZZZ2"]);
  });

  it("start empty", () => {
    expect(loadCustom()).toEqual([]);
  });

  it.each([
    ["not JSON", "not json"],
    ["JSON that is not a list", '{"a":1}'],
  ])("ignore storage holding %s", (_name, stored) => {
    window.localStorage.setItem("moatmine.screenerExtra", stored);
    expect(loadCustom()).toEqual([]);
  });

  it("drop entries that are malformed, keeping the good ones", () => {
    window.localStorage.setItem("moatmine.screenerExtra", JSON.stringify([entry("GOOD"), { symbol: "bad symbol!" }, { symbol: "NOSECTOR", name: "x" }, 7, null]));
    expect(loadCustom().map((e) => e.symbol)).toEqual(["GOOD"]);
  });
});

describe("withEntry", () => {
  it("adds a company to the end", () => {
    expect(withEntry([entry("AAA1")], entry("BBB1")).map((e) => e.symbol)).toEqual(["AAA1", "BBB1"]);
  });

  it("refuses a symbol already in the built-in list", () => {
    expect(() => withEntry([], entry("AAPL"))).toThrow("AAPL is already in the list");
  });

  it("refuses a symbol the user already added", () => {
    expect(() => withEntry([entry("AAA1")], entry("AAA1"))).toThrow("already in the list");
  });

  it("refuses something that is not a ticker symbol", () => {
    expect(() => withEntry([], entry("no way!"))).toThrow("not a ticker symbol");
  });

  it("refuses to go past the limit", () => {
    const full = Array.from({ length: MAX_CUSTOM }, (_, i) => entry(`Z${i}`));
    expect(() => withEntry(full, entry("ONEMORE"))).toThrow(`${MAX_CUSTOM} added companies`);
  });

  it("does not change the list it was given", () => {
    const list = [entry("AAA1")];
    withEntry(list, entry("BBB1"));
    expect(list).toHaveLength(1);
  });
});

describe("describeCompany", () => {
  it("takes the name, sector, industry and country from the company profile, for an upper-cased symbol", async () => {
    mockedApi.mockResolvedValue({ name: "Acme Corp", sector: "Industrials", industry: "Machinery", country: "Germany" });
    expect(await describeCompany(" acme ")).toEqual({ symbol: "ACME", name: "Acme Corp", sector: "Industrials", industry: "Machinery", country: "Germany" });
    expect(mockedApi).toHaveBeenCalledWith("/stocks/ACME/company");
  });

  it("calls whatever the data source leaves out Unknown, and uses the symbol as the name if there is none", async () => {
    mockedApi.mockResolvedValue({ name: "", industry: "" });
    expect(await describeCompany("zzz")).toEqual({ symbol: "ZZZ", name: "ZZZ", sector: UNKNOWN, industry: UNKNOWN, country: UNKNOWN });
  });

  it("refuses a malformed symbol without asking the data source", async () => {
    await expect(describeCompany("not a symbol")).rejects.toThrow("not a ticker symbol");
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("fails when the data source does not know the company", async () => {
    mockedApi.mockRejectedValue(new Error("no profile for NOPE"));
    await expect(describeCompany("NOPE")).rejects.toThrow("no profile");
  });
});
