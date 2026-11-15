import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addWatch } from "@/lib/data/watchlist";
import { describeCompany } from "@/lib/screener/custom";
import { loadMetrics, type Loaded } from "@/lib/screener/load";
import { UNIVERSE } from "@/lib/screener/universe";
import StockScreener from "./StockScreener";

vi.mock("@/lib/screener/load", () => ({ loadMetrics: vi.fn() }));
vi.mock("@/lib/data/watchlist", () => ({ addWatch: vi.fn() }));
vi.mock("@/lib/screener/custom", async (original) => ({ ...(await original<typeof import("@/lib/screener/custom")>()), describeCompany: vi.fn() }));
vi.mock("./SymbolSearch", () => ({
  default: ({ onPick, placeholder }: { onPick?: (s: string) => void; placeholder?: string }) => (
    <button onClick={() => onPick?.("NEWCO")}>{placeholder}</button>
  ),
}));

const done = (rows: Loaded["rows"], changes: Partial<Loaded> = {}): Loaded => ({ rows, source: "finnhub", cancelled: false, notLoaded: [], ...changes });

const ROWS = [
  { symbol: "AAPL", price: 200, perf_1m: 4, perf_3m: 10, perf_12m: 30, momentum: 25, vs_sma200: 3, pct_from_high: -3, pct_from_low: 40, volatility_pct: 22, pe: 28 },
  { symbol: "MSFT", price: 400, perf_1m: -2, perf_3m: -5, perf_12m: 12, momentum: 5, vs_sma200: -4, pct_from_high: -15, pct_from_low: 8, volatility_pct: 18, pe: 12 },
  { symbol: "NVDA", price: 900, perf_1m: 9, perf_3m: 40, perf_12m: 120, momentum: 90, vs_sma200: 12, pct_from_high: -1, pct_from_low: 110, volatility_pct: 55, pe: 60 },
  { symbol: "BAD", error: "MarketDataError" },
];

const loadButton = () => screen.getByRole("button", { name: /^Load the numbers for/ });
const results = () => screen.getByRole("list", { name: "Screener results" });
const symbolsShown = () => within(results()).queryAllByRole("link").map((a) => a.textContent);

async function loaded(source = "finnhub", watched: string[] = [], onAdded = vi.fn()) {
  vi.mocked(loadMetrics).mockResolvedValue(done(ROWS, { source }));
  render(<StockScreener watched={new Set(watched)} onAdded={onAdded} />);
  fireEvent.click(loadButton());
  await screen.findByRole("list", { name: "Screener results" });
  return onAdded;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(addWatch).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StockScreener", () => {
  it("offers to load every company in the list before anything is chosen", () => {
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    expect(loadButton().textContent).toBe(`Load the numbers for ${UNIVERSE.length} companies`);
  });

  it("narrows what will be loaded by sector and country before any data is fetched", () => {
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(screen.getByLabelText("Israel"));
    const israeli = UNIVERSE.filter((u) => u.country === "Israel").length;
    expect(loadButton().textContent).toBe(`Load the numbers for ${israeli} companies`);
    fireEvent.click(screen.getByLabelText("Software"));
    expect(loadButton().textContent).toContain(`${UNIVERSE.filter((u) => u.country === "Israel" && u.industry === "Software").length} companies`);
  });

  it("sends only the chosen companies' symbols to be loaded", async () => {
    vi.mocked(loadMetrics).mockResolvedValue(done([]));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(screen.getByLabelText("Israel"));
    fireEvent.click(loadButton());
    await waitFor(() => expect(loadMetrics).toHaveBeenCalled());
    const sent = vi.mocked(loadMetrics).mock.calls[0]?.[0] ?? [];
    expect([...sent].sort()).toEqual(UNIVERSE.filter((u) => u.country === "Israel").map((u) => u.symbol).sort());
  });

  it("shows the loaded stocks sorted by 3-month performance, leaves out one with no data and says so", async () => {
    await loaded();
    expect(symbolsShown()).toEqual(["NVDA", "AAPL", "MSFT"]);
    expect(screen.getByText("3 of 4 match")).toBeTruthy();
    expect(screen.getByText("1 companies had no data and are left out.")).toBeTruthy();
  });

  it("re-sorts the loaded stocks by the chosen measure and direction", async () => {
    await loaded();
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "pe" } });
    expect(symbolsShown()).toEqual(["NVDA", "AAPL", "MSFT"]);
    fireEvent.click(screen.getByRole("button", { name: "Change the sort direction" }));
    expect(symbolsShown()).toEqual(["MSFT", "AAPL", "NVDA"]);
  });

  it("narrows by a value filter at once, without loading again", async () => {
    await loaded();
    fireEvent.change(screen.getByLabelText("Value: max P/E"), { target: { value: "30" } });
    expect(symbolsShown()).toEqual(["AAPL", "MSFT"]);
    expect(loadMetrics).toHaveBeenCalledTimes(1);
  });

  it("a preset sets its filters: strong momentum keeps what is up 20% and above its 200-day average", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Strong momentum" }));
    expect(symbolsShown()).toEqual(["NVDA", "AAPL"]);
    expect((screen.getByLabelText("Above its 200-day average") as HTMLInputElement).checked).toBe(true);
  });

  it("clearing the filters brings everything back", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Strong momentum" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(symbolsShown()).toEqual(["NVDA", "AAPL", "MSFT"]);
  });

  it("warns that the numbers are sample data when the API says so", async () => {
    await loaded("mock-fallback");
    expect(screen.getByText("These numbers are sample data, not real prices.")).toBeTruthy();
  });

  it("adds one stock to the watchlist and tells the page to reload", async () => {
    const onAdded = await loaded();
    const row = within(results()).getByText("MSFT").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(addWatch).toHaveBeenCalledWith({ symbol: "MSFT", note: "", alert_above: null, alert_below: null });
    expect(await screen.findByText("Added 1 to your watchlist.")).toBeTruthy();
  });

  it("shows a stock already on the watchlist as watched and does not offer to add it again", async () => {
    await loaded("finnhub", ["AAPL"]);
    const row = within(results()).getByText("AAPL").closest("li") as HTMLElement;
    expect(within(row).getByText("Watching")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: "Add" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Add all shown/ }));
    await waitFor(() => expect(addWatch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(addWatch).mock.calls.map(([w]) => w.symbol).sort()).toEqual(["MSFT", "NVDA"]);
  });

  it("adds the selected stocks together", async () => {
    await loaded();
    fireEvent.click(screen.getByLabelText("NVDA"));
    fireEvent.click(screen.getByLabelText("MSFT"));
    fireEvent.click(screen.getByRole("button", { name: "Add selected (2)" }));
    await waitFor(() => expect(addWatch).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Added 2 to your watchlist.")).toBeTruthy();
  });

  it("reports the ones that could not be added, and still adds the rest", async () => {
    vi.mocked(addWatch).mockRejectedValueOnce(new Error("NVDA already on watchlist")).mockResolvedValue(undefined);
    await loaded();
    fireEvent.click(screen.getByLabelText("NVDA"));
    fireEvent.click(screen.getByLabelText("MSFT"));
    fireEvent.click(screen.getByRole("button", { name: "Add selected (2)" }));
    expect(await screen.findByText(/Added 1\. These were not added: NVDA: NVDA already on watchlist/)).toBeTruthy();
  });

  it("shows why the numbers could not be loaded", async () => {
    // loadMetrics reports feed trouble in its result; an unexpected error must not leave the screen stuck on "Loading"
    vi.mocked(loadMetrics).mockRejectedValue(new Error("Something broke"));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(loadButton());
    expect(await screen.findByText("Could not load the numbers: Something broke")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    expect(loadButton()).toBeTruthy();
  });
});

describe("StockScreener: loading", () => {
  it("shows rows as they arrive and offers Stop while it runs", async () => {
    let finish: (l: Loaded) => void = () => undefined;
    vi.mocked(loadMetrics).mockImplementation((_symbols, options) => new Promise<Loaded>((resolve) => {
      options?.onProgress?.([ROWS[0] as never], "finnhub", 6);
      finish = resolve;
    }));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(loadButton());

    expect(await screen.findByRole("button", { name: "Stop" })).toBeTruthy();
    expect(symbolsShown()).toEqual(["AAPL"]); // already visible, before the run has finished
    finish(done(ROWS));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).toBeNull());
    expect(symbolsShown()).toEqual(["NVDA", "AAPL", "MSFT"]);
  });

  it("Stop aborts the run, and the companies that were not loaded can be loaded afterwards", async () => {
    vi.mocked(loadMetrics).mockImplementationOnce((_symbols, options) => new Promise<Loaded>((resolve) => {
      options?.signal?.addEventListener("abort", () => resolve(done([ROWS[0] as never], { cancelled: true, notLoaded: ["MSFT", "NVDA"] })));
    }));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(loadButton());
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));

    expect(await screen.findByText(/Stopped\. 2 companies were not loaded\./)).toBeTruthy();
    vi.mocked(loadMetrics).mockResolvedValueOnce(done([ROWS[1] as never, ROWS[2] as never]));
    fireEvent.click(screen.getByRole("button", { name: "Load the other 2" }));
    await waitFor(() => expect(symbolsShown().sort()).toEqual(["AAPL", "MSFT", "NVDA"]));
  });

  it("says when the data source kept failing, and how many were not loaded", async () => {
    vi.mocked(loadMetrics).mockResolvedValue(done([], { notLoaded: ["A", "B", "C"] }));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(loadButton());
    expect(await screen.findByText(/The data source kept failing, so it stopped\. 3 companies were not loaded\./)).toBeTruthy();
  });

  it("explains that some were turned away as busy, and retries just the failed ones", async () => {
    vi.mocked(loadMetrics).mockResolvedValueOnce(done([ROWS[0] as never, { symbol: "MSFT", error: "rate_limited" }, { symbol: "NVDA", error: "timeout" }]));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(loadButton());
    expect(await screen.findByText(/2 companies had no data/)).toBeTruthy();
    expect(screen.getByText(/1 of them were turned away because the data source is busy/)).toBeTruthy();

    vi.mocked(loadMetrics).mockResolvedValueOnce(done([ROWS[1] as never, ROWS[2] as never]));
    fireEvent.click(screen.getByRole("button", { name: "Retry the 2" }));
    await waitFor(() => expect(symbolsShown().sort()).toEqual(["AAPL", "MSFT", "NVDA"]));
    expect(vi.mocked(loadMetrics).mock.calls[1]?.[0]).toEqual(["MSFT", "NVDA"]);
    expect(screen.queryByText(/had no data/)).toBeNull();
  });

  it("warns before a big run, and not before a small one", () => {
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    expect(screen.getByText(/is a long run on a free data plan/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Israel"));
    expect(screen.queryByText(/is a long run on a free data plan/)).toBeNull();
  });
});

describe("StockScreener: the search list", () => {
  it("shows the full list for the chosen location, with every company's sector, industry and country", () => {
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    expect(screen.getByText(`Show the full list (${UNIVERSE.length} of ${UNIVERSE.length} companies)`)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Israel"));
    const israeli = UNIVERSE.filter((u) => u.country === "Israel");
    expect(screen.getByText(`Show the full list (${israeli.length} of ${UNIVERSE.length} companies)`)).toBeTruthy();
    const list = screen.getByText(/^Show the full list/).closest("details") as HTMLElement;
    expect(within(list).getAllByRole("row").length).toBe(israeli.length + 1);
    expect(within(list).getByText("Teva Pharmaceutical")).toBeTruthy();
  });

  it("adds a company the user picked to the search list and keeps it for the next visit", async () => {
    vi.mocked(describeCompany).mockResolvedValue({ symbol: "NEWCO", name: "New Co", sector: "Technology", industry: "Software", country: "Canada" });
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Search a company or symbol" }));

    expect(await screen.findByText("NEWCO was added to the search list. It stays in this browser.")).toBeTruthy();
    expect(loadButton().textContent).toBe(`Load the numbers for ${UNIVERSE.length + 1} companies`);
    expect(JSON.parse(window.localStorage.getItem("moatmine.screenerExtra") ?? "[]")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Canada")); // its country is now a choice
    expect(loadButton().textContent).toBe("Load the numbers for 1 companies");
  });

  it("loads a company added earlier when the page is opened again", () => {
    window.localStorage.setItem("moatmine.screenerExtra", JSON.stringify([{ symbol: "OLDCO", name: "Old Co", sector: "Energy", industry: "Oil & Gas E&P", country: "Norway" }]));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    expect(loadButton().textContent).toBe(`Load the numbers for ${UNIVERSE.length + 1} companies`);
  });

  it("removes an added company from the full list, but never a built-in one", async () => {
    window.localStorage.setItem("moatmine.screenerExtra", JSON.stringify([{ symbol: "OLDCO", name: "Old Co", sector: "Energy", industry: "Oil & Gas E&P", country: "Norway" }]));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    const list = screen.getByText(/^Show the full list/).closest("details") as HTMLElement;
    const removable = within(list).getAllByRole("button", { name: "Remove" });
    expect(removable).toHaveLength(1);
    fireEvent.click(removable[0] as HTMLElement);
    expect(loadButton().textContent).toBe(`Load the numbers for ${UNIVERSE.length} companies`);
    expect(JSON.parse(window.localStorage.getItem("moatmine.screenerExtra") ?? "[]")).toEqual([]);
  });

  it("says why a company could not be added", async () => {
    vi.mocked(describeCompany).mockRejectedValue(new Error("no profile for NEWCO"));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Search a company or symbol" }));
    expect(await screen.findByText("Could not add it: no profile for NEWCO")).toBeTruthy();
    expect(loadButton().textContent).toBe(`Load the numbers for ${UNIVERSE.length} companies`);
  });
});
