import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiWithHeaders, type Portfolio } from "../api";
import { getPortfolio } from "./portfolio";
import { portfolioHistory } from "./history";

vi.mock("../api", () => ({ apiWithHeaders: vi.fn() }));
vi.mock("./portfolio", () => ({ getPortfolio: vi.fn(), LOCAL_BOOK: "real" }));
const mockedHeaders = vi.mocked(apiWithHeaders);

const DAY = 86_400;
const T0 = Math.floor(Date.now() / 1000 / DAY) * DAY - 10 * DAY;
const bar = (i: number, c: number) => ({ t: T0 + i * DAY + 50, c });
const reply = (data: { t: number; c: number }[], source = "finnhub+fmp") => ({ data, headers: new Headers({ "X-Data-Source": source }) }) as never;

const book = (rows: { symbol: string; quantity: number }[]) => ({ holdings: rows }) as unknown as Portfolio;

beforeEach(() => {
  mockedHeaders.mockReset();
  vi.mocked(getPortfolio).mockReset();
});

describe("portfolioHistory", () => {
  it("asks the server for the chosen book when not local, and returns its label", async () => {
    mockedHeaders.mockResolvedValue({ data: [{ t: 1, value: 2 }], headers: new Headers({ "X-Data-Source": "finnhub" }) } as never);
    expect(await portfolioHistory(90, "paper", false)).toEqual({ points: [{ t: 1, value: 2 }], source: "finnhub" });
    expect(mockedHeaders).toHaveBeenCalledWith("/portfolio/history?days=90&mode=paper");
  });

  it("values the on-device holdings day by day at today's quantities, summing quantities per symbol", async () => {
    vi.mocked(getPortfolio).mockResolvedValue(book([{ symbol: "AAA", quantity: 2 }, { symbol: "AAA", quantity: 1 }, { symbol: "BBB", quantity: 10 }]));
    mockedHeaders.mockImplementation(async (path: string) => (path.includes("/AAA/") ? reply([bar(0, 10), bar(1, 11)]) : reply([bar(0, 5), bar(1, 6)])));

    const out = await portfolioHistory(30, "real", true);

    expect(out.points.map((p) => p.value)).toEqual([80, 93]); // 3 x 10 + 10 x 5, then 3 x 11 + 10 x 6
    expect(out.source).toBe("finnhub+fmp");
  });

  it("asks for each symbol's daily bars over the requested span", async () => {
    vi.mocked(getPortfolio).mockResolvedValue(book([{ symbol: "AAA", quantity: 1 }]));
    mockedHeaders.mockResolvedValue(reply([bar(0, 1)]));
    await portfolioHistory(90, "real", true);
    const path = String(mockedHeaders.mock.calls[0]?.[0]);
    const [, query = ""] = path.split("?");
    const params = new URLSearchParams(query);
    expect(path).toContain("/stocks/AAA/candles");
    expect(params.get("resolution")).toBe("D");
    expect(Number(params.get("end")) - Number(params.get("start"))).toBe(90 * DAY);
  });

  it("labels the whole line as sample data if any symbol's prices are", async () => {
    vi.mocked(getPortfolio).mockResolvedValue(book([{ symbol: "AAA", quantity: 1 }, { symbol: "BBB", quantity: 1 }]));
    mockedHeaders.mockImplementation(async (path: string) => reply([bar(0, 1)], path.includes("/BBB/") ? "mock-fallback" : "finnhub"));
    expect((await portfolioHistory(30, "real", true)).source).toBe("mock-fallback");
  });

  it("is empty, with no price requests, when nothing is held", async () => {
    vi.mocked(getPortfolio).mockResolvedValue(book([]));
    expect(await portfolioHistory(30, "real", true)).toEqual({ points: [], source: "" });
    expect(mockedHeaders).not.toHaveBeenCalled();
  });

  it("fails when prices for a held symbol cannot be fetched", async () => {
    vi.mocked(getPortfolio).mockResolvedValue(book([{ symbol: "AAA", quantity: 1 }]));
    mockedHeaders.mockRejectedValue(new Error("no prices"));
    await expect(portfolioHistory(30, "real", true)).rejects.toThrow("no prices");
  });
});
