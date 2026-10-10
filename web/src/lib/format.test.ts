import { describe, expect, it } from "vitest";
import { date, money, num, pct, share } from "./format";

// the invisible left-to-right isolate around every number keeps "-5.00%" intact inside Hebrew text
const iso = (s: string) => `⁦${s}⁩`;

describe("money", () => {
  it.each([
    [1234.5, undefined, undefined, iso("$1,234.50")],
    [-20, undefined, undefined, iso("-$20.00")],
    [1234567.89, "USD", 0, iso("$1,234,568")],
    [null, undefined, undefined, "—"],
  ] as const)("%s %s %s → %s", (n, cur, d, expected) => {
    expect(money(n, cur, d)).toBe(expected);
  });
});

describe("num", () => {
  it.each([[1.23456, 2, iso("1.23")], [undefined, 2, "—"]] as const)("%s → %s", (n, d, expected) => {
    expect(num(n, d)).toBe(expected);
  });
});

describe("pct", () => {
  it.each([
    [3.2, true, iso("+3.20%")],
    [-5, true, iso("-5.00%")],
    [3.2, false, iso("3.20%")],
    [null, true, "—"],
  ] as const)("%s signed=%s → %s", (n, signed, expected) => {
    expect(pct(n, signed)).toBe(expected);
  });
});

describe("share", () => {
  it.each([
    [25, undefined, iso("25%")],
    [12.345, undefined, iso("12.35%")],
    [-5, 1, iso("-5%")],
    [12345, undefined, iso("12345%")],
    [null, undefined, "—"],
  ] as const)("%s (%s decimals) → %s", (n, d, expected) => {
    expect(share(n, d)).toBe(expected);
  });
});

describe("date", () => {
  it.each([
    ["en", "Oct 10, 2026"],
    ["he", new Date("2026-10-10T12:00:00Z").toLocaleDateString("he-IL", { month: "short", day: "numeric", year: "numeric" })],
  ] as const)("formats in %s", (lang, expected) => {
    expect(date("2026-10-10T12:00:00Z", lang)).toBe(expected);
  });
});
