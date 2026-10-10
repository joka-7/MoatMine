import { describe, expect, it } from "vitest";
import { MESSAGES, MODULES } from "./messages";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("MESSAGES", () => {
  it("has no key defined by two modules (the merge would silently keep only one)", () => {
    const all = Object.values(MODULES).flatMap((m) => Object.keys(m.en));
    expect(all.filter((k, i) => all.indexOf(k) !== i)).toEqual([]);
  });

  it("gives every English text a non-empty Hebrew one with the same placeholders", () => {
    const wrong = Object.entries(MESSAGES.en).filter(([key, en]) => {
      const he = MESSAGES.he[key as keyof typeof MESSAGES.he];
      return !he?.trim() || placeholders(he).join() !== placeholders(en).join();
    });
    expect(wrong.map(([key]) => key)).toEqual([]);
  });
});
