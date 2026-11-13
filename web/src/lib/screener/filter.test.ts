import { describe, expect, it } from "vitest";
import { candidates, matches, NO_FILTERS, PRESETS, sortRows, type Filters, type MetricRow } from "./filter";
import { UNIVERSE, type UniverseEntry } from "./universe";

const f = (changes: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...changes });
const row = (changes: Partial<MetricRow> = {}): MetricRow => ({ symbol: "AAA", ...changes });

describe("candidates", () => {
  const universe: UniverseEntry[] = [
    { symbol: "A", name: "A", sector: "Technology", industry: "Software", country: "United States" },
    { symbol: "B", name: "B", sector: "Technology", industry: "Semiconductors", country: "Taiwan" },
    { symbol: "C", name: "C", sector: "Energy", industry: "Oil & Gas E&P", country: "United States" },
  ];

  it("returns everything when nothing is chosen", () => {
    expect(candidates(NO_FILTERS, universe).map((u) => u.symbol)).toEqual(["A", "B", "C"]);
  });

  it.each([
    ["a sector", { sectors: ["Technology"] }, ["A", "B"]],
    ["a country", { countries: ["United States"] }, ["A", "C"]],
    ["an industry", { industries: ["Semiconductors"] }, ["B"]],
    ["several sectors", { sectors: ["Technology", "Energy"] }, ["A", "B", "C"]],
    ["a sector and a country together", { sectors: ["Technology"], countries: ["United States"] }, ["A"]],
    ["a combination nobody has", { sectors: ["Energy"], countries: ["Taiwan"] }, []],
  ])("narrows by %s", (_name, changes, expected) => {
    expect(candidates(f(changes), universe).map((u) => u.symbol)).toEqual(expected);
  });
});

describe("matches", () => {
  it("passes everything that loaded when no filter is set", () => {
    expect(matches(row(), NO_FILTERS)).toBe(true);
  });

  it("never matches a stock whose data failed to load", () => {
    expect(matches(row({ error: "MarketDataError" }), NO_FILTERS)).toBe(false);
  });

  it.each([
    ["P/E at the limit", { maxPe: 15 }, { pe: 15 }, true],
    ["P/E over the limit", { maxPe: 15 }, { pe: 15.01 }, false],
    ["a negative P/E (a loss) is not cheap", { maxPe: 15 }, { pe: -5 }, false],
    ["volatility at the limit", { maxVolatility: 25 }, { volatility_pct: 25 }, true],
    ["volatility over the limit", { maxVolatility: 25 }, { volatility_pct: 25.5 }, false],
    ["a fall no worse than the limit", { maxDrawdown: 20 }, { max_drawdown_pct: -20 }, true],
    ["a fall worse than the limit", { maxDrawdown: 20 }, { max_drawdown_pct: -20.5 }, false],
    ["return at the minimum", { minPerf: 5 }, { perf_3m: 5 }, true],
    ["return under the minimum", { minPerf: 5 }, { perf_3m: 4.9 }, false],
    ["return over the maximum", { maxPerf: 0 }, { perf_3m: 1 }, false],
    ["return in the chosen window only", { perfWindow: "perf_1m", minPerf: 5 }, { perf_1m: 6, perf_3m: -9 }, true],
    ["momentum at the minimum", { minMomentum: 20 }, { momentum: 20 }, true],
    ["momentum under the minimum", { minMomentum: 20 }, { momentum: 19.9 }, false],
    ["above the 200-day average", { aboveSma200: true }, { vs_sma200: 0.1 }, true],
    ["below the 200-day average", { aboveSma200: true }, { vs_sma200: -0.1 }, false],
    ["within range of the 52-week high", { nearHigh: 5 }, { pct_from_high: -5 }, true],
    ["further than that from the high", { nearHigh: 5 }, { pct_from_high: -5.1 }, false],
    ["within range of the 52-week low", { nearLow: 10 }, { pct_from_low: 10 }, true],
    ["further than that above the low", { nearLow: 10 }, { pct_from_low: 10.1 }, false],
  ])("%s", (_name, filters, metrics, expected) => {
    expect(matches(row(metrics as Partial<MetricRow>), f(filters as Partial<Filters>))).toBe(expected);
  });

  it.each([
    ["P/E", { maxPe: 15 }], ["volatility", { maxVolatility: 25 }], ["drawdown", { maxDrawdown: 20 }], ["performance", { minPerf: 0 }],
    ["momentum", { minMomentum: 0 }], ["the 200-day average", { aboveSma200: true }], ["the high", { nearHigh: 5 }], ["the low", { nearLow: 5 }],
  ])("a missing number fails a filter on %s, so unknowns never slip through", (_name, filters) => {
    expect(matches(row({ symbol: "NEW" }), f(filters as Partial<Filters>))).toBe(false);
  });

  it("needs every filter to pass", () => {
    const both = f({ maxVolatility: 30, minMomentum: 10 });
    expect(matches(row({ volatility_pct: 20, momentum: 15 }), both)).toBe(true);
    expect(matches(row({ volatility_pct: 20, momentum: 5 }), both)).toBe(false);
  });
});

describe("PRESETS", () => {
  it("each sets only what its name says", () => {
    expect(PRESETS.nearLow).toEqual({ ...NO_FILTERS, nearLow: 10 });
    expect(matches(row({ momentum: 25, vs_sma200: 3 }), PRESETS.momentum)).toBe(true);
    expect(matches(row({ volatility_pct: 20, max_drawdown_pct: -15 }), PRESETS.lowRisk)).toBe(true);
    expect(matches(row({ pe: 12 }), PRESETS.cheap)).toBe(true);
  });
});

describe("sortRows", () => {
  const rows = [row({ symbol: "B", perf_3m: 5 }), row({ symbol: "A", perf_3m: null }), row({ symbol: "C", perf_3m: 12 }), row({ symbol: "D" })];

  it("sorts high to low with unknowns last", () => {
    expect(sortRows(rows, "perf_3m", "desc").map((r) => r.symbol)).toEqual(["C", "B", "A", "D"]);
  });

  it("sorts low to high with unknowns still last", () => {
    expect(sortRows(rows, "perf_3m", "asc").map((r) => r.symbol)).toEqual(["B", "C", "A", "D"]);
  });

  it("sorts by symbol, and does not change the list it was given", () => {
    expect(sortRows(rows, "symbol", "asc").map((r) => r.symbol)).toEqual(["A", "B", "C", "D"]);
    expect(rows.map((r) => r.symbol)).toEqual(["B", "A", "C", "D"]);
  });
});

describe("UNIVERSE", () => {
  it("has no repeated symbol, and every entry is classified", () => {
    const symbols = UNIVERSE.map((u) => u.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const u of UNIVERSE) expect([u.name, u.sector, u.industry, u.country].every((v) => v.length > 0)).toBe(true);
  });

  it("covers more than one country, so the area filter has something to choose", () => {
    expect(new Set(UNIVERSE.map((u) => u.country)).size).toBeGreaterThan(5);
    expect(UNIVERSE.filter((u) => u.country === "Israel").length).toBeGreaterThan(3);
  });
});

describe("UNIVERSE in Hebrew", () => {
  it("has a Hebrew name for every sector, industry and country, so the Hebrew screen shows no English labels", async () => {
    const { translateServerText } = await import("../i18n/serverText");
    const missing = new Set<string>();
    for (const u of UNIVERSE) {
      for (const label of [u.sector, u.industry, u.country]) if (translateServerText(label, "he") === label) missing.add(label);
    }
    expect([...missing]).toEqual([]);
  });
});
