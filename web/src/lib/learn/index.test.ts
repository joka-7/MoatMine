import { describe, expect, it } from "vitest";
import { LEARN_MODULES, type Localized } from ".";
import { LANGS } from "@/lib/i18n";

const texts = (l: Localized) => LANGS.map((lang) => l[lang]);
const lessons = LEARN_MODULES.flatMap((m) => m.lessons.map((lesson) => ({ module: m.id, lesson })));

describe("LEARN_MODULES", () => {
  it("has the seven modules, each with a unique id", () => {
    const ids = LEARN_MODULES.map((m) => m.id);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });

  it("gives every text in every language non-empty content", () => {
    const all = LEARN_MODULES.flatMap((m) => [
      m.title, m.summary,
      ...m.lessons.flatMap((l) => [l.title, ...l.body, ...l.details, ...l.examples]),
    ]);
    expect(all.flatMap(texts).filter((s) => !s.trim())).toEqual([]);
  });

  it("gives every module at least three lessons", () => {
    expect(LEARN_MODULES.filter((m) => m.lessons.length < 3).map((m) => m.id)).toEqual([]);
  });

  it("gives every lesson its body, more details and several examples", () => {
    const thin = lessons.filter(({ lesson }) => lesson.body.length < 1 || lesson.details.length < 1 || lesson.examples.length < 3);
    expect(thin.map(({ module, lesson }) => `${module}: ${lesson.title.en}`)).toEqual([]);
  });

  it("only links 'see it in the app' to in-app routes", () => {
    const links = lessons.flatMap(({ lesson }) => (lesson.tryIt ? [lesson.tryIt] : []));
    expect(links.filter((href) => !href.startsWith("/"))).toEqual([]);
  });

  it("keeps texts distinct within a lesson so React keys stay unique", () => {
    const dupes = lessons.filter(({ lesson }) =>
      [lesson.body, lesson.details, lesson.examples].some((list) => new Set(list.map((p) => p.en)).size !== list.length),
    );
    expect(dupes.map(({ module, lesson }) => `${module}: ${lesson.title.en}`)).toEqual([]);
  });
});
