import { describe, expect, it } from "vitest";
import { isSampleData } from "./dataSource";

describe("isSampleData", () => {
  it.each([
    ["mock", true],
    ["mock-fallback", true],
    ["finnhub", false],
    ["fmp", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("%s -> %s", (source, expected) => {
    expect(isSampleData(source)).toBe(expected);
  });
});
