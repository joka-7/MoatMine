import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { CHUNK, loadMetrics } from "./load";

vi.mock("../api", () => ({ api: vi.fn() }));
const mockedApi = vi.mocked(api);

const symbols = (n: number) => Array.from({ length: n }, (_, i) => `S${i}`);

beforeEach(() => {
  mockedApi.mockReset();
  mockedApi.mockImplementation(async (path: string) => {
    const wanted = new URL(path, "http://x").searchParams.get("symbols")?.split(",") ?? [];
    return { rows: wanted.map((symbol) => ({ symbol })), data_source: "finnhub" };
  });
});

describe("loadMetrics", () => {
  it("fetches in chunks of the API's limit, in order, and keeps the rows in order", async () => {
    const out = await loadMetrics(symbols(CHUNK * 2 + 3));
    expect(mockedApi).toHaveBeenCalledTimes(3);
    expect(out.rows.map((r) => r.symbol)).toEqual(symbols(CHUNK * 2 + 3));
  });

  it("makes no request for an empty list", async () => {
    expect(await loadMetrics([])).toEqual({ rows: [], source: "" });
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("reports progress after each chunk, never past the total", async () => {
    const seen: number[] = [];
    await loadMetrics(symbols(CHUNK + 5), (done) => seen.push(done));
    expect(seen).toEqual([CHUNK, CHUNK + 5]);
  });

  it("sends only ticker symbols", async () => {
    await loadMetrics(["AAPL", "MSFT"]);
    expect(mockedApi).toHaveBeenCalledWith("/screener/metrics?symbols=AAPL%2CMSFT");
  });

  it("labels the whole result as sample data when any chunk is", async () => {
    mockedApi.mockResolvedValueOnce({ rows: [{ symbol: "A" }], data_source: "finnhub" });
    mockedApi.mockResolvedValueOnce({ rows: [{ symbol: "B" }], data_source: "mock-fallback" });
    expect((await loadMetrics(symbols(CHUNK + 1))).source).toBe("mock-fallback");
  });

  it("fails, rather than return a partial list, when a request fails", async () => {
    mockedApi.mockResolvedValueOnce({ rows: [], data_source: "finnhub" });
    mockedApi.mockRejectedValueOnce(new Error("Too many requests; slow down."));
    await expect(loadMetrics(symbols(CHUNK + 1))).rejects.toThrow("slow down");
  });
});
