import { describe, expect, it } from "vitest";
import { dirFor, fill } from "./translate";

describe("fill", () => {
  it.each([
    ["no placeholders", "Sign in", {}, "Sign in"],
    ["one placeholder", "Sign-in failed ({code}).", { code: "auth/x" }, "Sign-in failed (auth/x)."],
    ["a number, twice", "{n} of {n}", { n: 3 }, "3 of 3"],
    ["an unused extra value", "Hi", { n: 1 }, "Hi"],
  ])("%s", (_, message, vars, expected) => {
    expect(fill(message, vars)).toBe(expected);
  });

  it("throws when a placeholder has no value", () => {
    expect(() => fill("Limit {pct}")).toThrow("Missing value for {pct}");
  });
});

describe("dirFor", () => {
  it.each([["en", "ltr"], ["he", "rtl"]] as const)("%s is %s", (lang, dir) => {
    expect(dirFor(lang)).toBe(dir);
  });
});
