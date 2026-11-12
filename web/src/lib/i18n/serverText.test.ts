import { describe, expect, it } from "vitest";
import cases from "../../../../backend/tests/vectors/server_text.json";
import spec from "./serverText.he.json";
import { translateServerText } from "./serverText";

describe("translateServerText", () => {
  it.each(cases.cases.map((c) => [c.en || "(empty)", c] as const))("%s", (_name, c) => {
    expect(translateServerText(c.en, "he")).toBe(c.he);
  });

  it("leaves English exactly as it is", () => {
    for (const c of cases.cases) expect(translateServerText(c.en, "en")).toBe(c.en);
  });
});

describe("serverText.he.json", () => {
  const placeholders = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
  const captures = (en: string) => en.split(/(\{[^}]*\})/).filter((p) => p.startsWith("{")).length;

  it.each(spec.patterns.map((p) => [p.en, p] as const))("every placeholder in the Hebrew of %s refers to a capture of its English", (_name, p) => {
    const n = captures(p.en);
    for (const i of placeholders(p.he)) expect(i).toBeGreaterThanOrEqual(1);
    for (const i of placeholders(p.he)) expect(i).toBeLessThanOrEqual(n);
  });

  it("translates every exact entry to something with Hebrew letters", () => {
    for (const [en, he] of Object.entries(spec.exact)) {
      if (/[A-Za-z]/.test(he) && !/[֐-׿]/.test(he)) throw new Error(`${en} has no Hebrew`);
    }
  });
});
