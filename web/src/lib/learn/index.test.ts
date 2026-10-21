import { describe, expect, it } from "vitest";
import { LEARN_MODULES, LESSON_MEDIA, type Localized } from ".";
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

describe("LESSON_MEDIA", () => {
  const ALLOWED_HOSTS = ["www.youtube.com", "www.kan.org.il"];
  const links = Object.values(LESSON_MEDIA).flat(2);

  it("has one entry per lesson of every module, in lesson order, and no entries for unknown modules", () => {
    expect(Object.keys(LESSON_MEDIA).sort()).toEqual(LEARN_MODULES.map((m) => m.id).sort());
    const misaligned = LEARN_MODULES.filter((m) => LESSON_MEDIA[m.id]?.length !== m.lessons.length);
    expect(misaligned.map((m) => m.id)).toEqual([]);
  });

  it("links only over https to sites we have checked", () => {
    const bad = links.filter((l) => {
      const url = new URL(l.url);
      return url.protocol !== "https:" || !ALLOWED_HOSTS.includes(url.hostname);
    });
    expect(bad.map((l) => l.url)).toEqual([]);
  });

  it("gives every link a title, a channel, a known language and a short length", () => {
    const bad = links.filter(
      (l) => !l.title.trim() || !l.channel.trim() || !LANGS.includes(l.lang) || l.minutes < 1 || l.minutes > 35,
    );
    expect(bad.map((l) => l.url)).toEqual([]);
  });

  it("lists a link at most once per lesson", () => {
    const dupes = Object.entries(LESSON_MEDIA).flatMap(([id, lessons]) =>
      lessons.flatMap((list, i) => (new Set(list.map((l) => l.url)).size !== list.length ? [`${id} #${i + 1}`] : [])),
    );
    expect(dupes).toEqual([]);
  });

  it("links a YouTube video by its 11-character id and marks anything else as a podcast", () => {
    const bad = links.filter((l) => {
      const isYoutube = new URL(l.url).hostname === "www.youtube.com";
      const id = new URL(l.url).searchParams.get("v") ?? "";
      return isYoutube ? l.kind !== "video" || !/^[\w-]{11}$/.test(id) : l.kind !== "podcast";
    });
    expect(bad.map((l) => l.url)).toEqual([]);
  });
});
