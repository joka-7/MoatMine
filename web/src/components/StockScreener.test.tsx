import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addWatch } from "@/lib/data/watchlist";
import { loadMetrics } from "@/lib/screener/load";
import { UNIVERSE } from "@/lib/screener/universe";
import StockScreener from "./StockScreener";

vi.mock("@/lib/screener/load", () => ({ loadMetrics: vi.fn() }));
vi.mock("@/lib/data/watchlist", () => ({ addWatch: vi.fn() }));

const ROWS = [
  { symbol: "AAPL", price: 200, perf_1m: 4, perf_3m: 10, perf_12m: 30, momentum: 25, vs_sma200: 3, pct_from_high: -3, pct_from_low: 40, volatility_pct: 22, pe: 28 },
  { symbol: "MSFT", price: 400, perf_1m: -2, perf_3m: -5, perf_12m: 12, momentum: 5, vs_sma200: -4, pct_from_high: -15, pct_from_low: 8, volatility_pct: 18, pe: 12 },
  { symbol: "NVDA", price: 900, perf_1m: 9, perf_3m: 40, perf_12m: 120, momentum: 90, vs_sma200: 12, pct_from_high: -1, pct_from_low: 110, volatility_pct: 55, pe: 60 },
  { symbol: "BAD", error: "MarketDataError" },
];

const loadButton = () => screen.getByRole("button", { name: /^Load the numbers for/ });
const symbolsShown = () => within(screen.getByRole("table")).queryAllByRole("link").map((a) => a.textContent);

async function loaded(source = "finnhub", watched: string[] = [], onAdded = vi.fn()) {
  vi.mocked(loadMetrics).mockResolvedValue({ rows: ROWS, source });
  render(<StockScreener watched={new Set(watched)} onAdded={onAdded} />);
  fireEvent.click(loadButton());
  await screen.findByRole("table");
  return onAdded;
}

beforeEach(() => vi.mocked(addWatch).mockResolvedValue(undefined));
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
    vi.mocked(loadMetrics).mockResolvedValue({ rows: [], source: "finnhub" });
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
    const row = screen.getByText("MSFT").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(addWatch).toHaveBeenCalledWith({ symbol: "MSFT", note: "", alert_above: null, alert_below: null });
    expect(await screen.findByText("Added 1 to your watchlist.")).toBeTruthy();
  });

  it("shows a stock already on the watchlist as watched and does not offer to add it again", async () => {
    await loaded("finnhub", ["AAPL"]);
    const row = screen.getByText("AAPL").closest("tr") as HTMLElement;
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
    vi.mocked(loadMetrics).mockRejectedValue(new Error("Too many requests; slow down."));
    render(<StockScreener watched={new Set()} onAdded={() => undefined} />);
    fireEvent.click(loadButton());
    expect(await screen.findByText("Could not load the numbers: Too many requests; slow down.")).toBeTruthy();
  });
});
