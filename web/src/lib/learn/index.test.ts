import { describe, expect, it } from "vitest";
import { LEARN_MODULES, type Localized } from ".";
import { LANGS } from "@/lib/i18n";

const texts = (l: Localized) => LANGS.map((lang) => l[lang]);

describe("LEARN_MODULES", () => {
  it("has the seven modules, each with a unique id", () => {
    const ids = LEARN_MODULES.map((m) => m.id);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });

  it("gives every text in every language non-empty content", () => {
    const all = LEARN_MODULES.flatMap((m) => [
      m.title, m.summary,
      ...m.lessons.flatMap((l) => [l.title, ...l.body]),
      ...m.quiz.flatMap((q) => [q.prompt, q.explanation, ...q.options]),
    ]);
    expect(all.flatMap(texts).filter((s) => !s.trim())).toEqual([]);
  });

  it("gives every module lessons and a quiz whose answers point at a real option", () => {
    const bad = LEARN_MODULES.filter(
      (m) => m.lessons.length < 3 || m.quiz.length < 3 || m.quiz.some((q) => q.options.length < 2 || !q.options[q.answer]),
    );
    expect(bad.map((m) => m.id)).toEqual([]);
  });

  it("only links 'see it in the app' to in-app routes", () => {
    const links = LEARN_MODULES.flatMap((m) => m.lessons.flatMap((l) => (l.tryIt ? [l.tryIt] : [])));
    expect(links.filter((href) => !href.startsWith("/"))).toEqual([]);
  });

  it("keeps each question's options distinct so React keys stay unique", () => {
    const dupes = LEARN_MODULES.flatMap((m) => m.quiz).filter((q) => new Set(q.options.map((o) => o.en)).size !== q.options.length);
    expect(dupes).toEqual([]);
  });
});
