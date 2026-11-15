import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { CHUNK, loadMetrics, MAX_CONSECUTIVE_FAILURES } from "./load";

vi.mock("../api", () => ({ api: vi.fn() }));
const mockedApi = vi.mocked(api);

const symbols = (n: number) => Array.from({ length: n }, (_, i) => `S${i}`);
const wantedIn = (path: string) => new URL(path, "http://x").searchParams.get("symbols")?.split(",") ?? [];

beforeEach(() => {
  mockedApi.mockReset();
  mockedApi.mockImplementation(async (path: string) => ({ rows: wantedIn(path).map((symbol) => ({ symbol })), data_source: "finnhub" }));
});

describe("loadMetrics", () => {
  it("asks a few companies at a time, in order, and keeps the rows in order", async () => {
    const out = await loadMetrics(symbols(CHUNK * 2 + 3));
    expect(mockedApi).toHaveBeenCalledTimes(3);
    expect(out.rows.map((r) => r.symbol)).toEqual(symbols(CHUNK * 2 + 3));
    expect(out).toMatchObject({ cancelled: false, notLoaded: [] });
  });

  it("makes no request for an empty list", async () => {
    expect(await loadMetrics([])).toEqual({ rows: [], source: "", cancelled: false, notLoaded: [] });
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("hands over what has loaded after every request, so the table can fill in", async () => {
    const seen: [number, number][] = [];
    await loadMetrics(symbols(CHUNK + 2), { onProgress: (rows, _source, done) => seen.push([rows.length, done]) });
    expect(seen).toEqual([[CHUNK, CHUNK], [CHUNK + 2, CHUNK + 2]]);
  });

  it("sends only ticker symbols", async () => {
    await loadMetrics(["AAPL", "MSFT"]);
    expect(mockedApi.mock.calls[0]?.[0]).toBe("/screener/metrics?symbols=AAPL%2CMSFT");
  });

  it("labels the whole result as sample data when any request came back so", async () => {
    mockedApi.mockResolvedValueOnce({ rows: [{ symbol: "A" }], data_source: "finnhub" });
    mockedApi.mockResolvedValueOnce({ rows: [{ symbol: "B" }], data_source: "mock-fallback" });
    expect((await loadMetrics(symbols(CHUNK + 1))).source).toBe("mock-fallback");
  });

  it("stops when the user presses Stop, keeping what had arrived and saying what was left", async () => {
    const controller = new AbortController();
    mockedApi.mockImplementation(async (path: string) => {
      if (mockedApi.mock.calls.length === 2) controller.abort(); // Stop pressed while the second request is out
      return { rows: wantedIn(path).map((symbol) => ({ symbol })), data_source: "finnhub" };
    });
    const out = await loadMetrics(symbols(CHUNK * 4), { signal: controller.signal });
    expect(out.cancelled).toBe(true);
    expect(out.rows.length).toBe(CHUNK * 2);
    expect(out.notLoaded).toEqual(symbols(CHUNK * 4).slice(CHUNK * 2));
  });

  it("does not ask for anything when stopped before it starts", async () => {
    const controller = new AbortController();
    controller.abort();
    const out = await loadMetrics(symbols(10), { signal: controller.signal });
    expect(mockedApi).not.toHaveBeenCalled();
    expect(out).toMatchObject({ cancelled: true, rows: [], notLoaded: symbols(10) });
  });

  it("marks only the companies of a failed request as failed and carries on with the rest", async () => {
    mockedApi.mockImplementationOnce(async () => { throw Object.assign(new Error("Too many requests; slow down."), { status: 429 }); });
    const out = await loadMetrics(symbols(CHUNK * 2));
    expect(out.rows.slice(0, CHUNK).every((r) => r.error === "rate_limited")).toBe(true);
    expect(out.rows.slice(CHUNK).every((r) => r.error === undefined)).toBe(true);
    expect(out.notLoaded).toEqual([]);
  });

  it("calls a request that ran out of time a timeout", async () => {
    mockedApi.mockImplementationOnce(async () => { throw Object.assign(new Error("took too long"), { name: "TimeoutError" }); });
    expect((await loadMetrics(symbols(2))).rows.map((r) => r.error)).toEqual(["timeout", "timeout"]);
  });

  it("gives up after several requests in a row fail, instead of grinding through the whole list", async () => {
    mockedApi.mockImplementation(async () => { throw new Error("down"); });
    const out = await loadMetrics(symbols(CHUNK * 10));
    expect(mockedApi).toHaveBeenCalledTimes(MAX_CONSECUTIVE_FAILURES);
    expect(out.rows.every((r) => r.error === "no_data")).toBe(true);
    expect(out.notLoaded).toEqual(symbols(CHUNK * 10).slice(CHUNK * MAX_CONSECUTIVE_FAILURES));
  });

  it("a success resets the count of failures in a row", async () => {
    mockedApi.mockImplementationOnce(async () => { throw new Error("blip"); });
    mockedApi.mockImplementationOnce(async () => { throw new Error("blip"); });
    const out = await loadMetrics(symbols(CHUNK * 5));
    expect(out.notLoaded).toEqual([]);
    expect(mockedApi).toHaveBeenCalledTimes(5);
  });
});
