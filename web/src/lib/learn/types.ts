import type { Lang } from "@/lib/i18n";

/** One text in every display language; the compiler rejects a lesson missing a translation. */
export type Localized = Readonly<Record<Lang, string>>;

export const text = (en: string, he: string): Localized => ({ en, he });

export interface Lesson {
  readonly title: Localized;
  /** The lesson itself: short paragraphs, in reading order. */
  readonly body: readonly Localized[];
  /** Extra depth, shown on request. */
  readonly details: readonly Localized[];
  /** Worked examples with made-up numbers, shown on request. */
  readonly examples: readonly Localized[];
  /** App screen that shows this lesson's idea on the user's own data. */
  readonly tryIt?: string;
}

export interface LearnModule {
  readonly id: string;
  readonly title: Localized;
  readonly summary: Localized;
  readonly lessons: readonly Lesson[];
}
