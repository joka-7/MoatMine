import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Ratios } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import RatiosPanel from "./RatiosPanel";

vi.mock("@/lib/useApi", () => ({ useApi: vi.fn() }));

beforeAll(() => {
  // jsdom has no layout; recharts' ResponsiveContainer only needs the constructor to exist
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

function showing(dataSource: string) {
  const data: Ratios = { fundamental: { pe: 20 }, price: { volatility_pct: 25 }, data_source: dataSource };
  vi.mocked(useApi).mockReturnValue({ data, error: null, loading: false, reload: async () => undefined, setData: () => undefined });
  render(<RatiosPanel symbol="AAPL" />);
}

describe("RatiosPanel", () => {
  it.each([
    ["mock", true],
    ["mock-fallback", true],
    ["finnhub", false],
  ])("labels sample data (source %s: %s)", (source, labelled) => {
    showing(source);
    expect(screen.queryByText(/sample data, not real prices/) !== null).toBe(labelled);
  });
});
