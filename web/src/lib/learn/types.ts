import type { Lang } from "@/lib/i18n";

/** One text in every display language; the compiler rejects a lesson missing a translation. */
export type Localized = Readonly<Record<Lang, string>>;

export const text = (en: string, he: string): Localized => ({ en, he });

export interface Lesson {
  readonly title: Localized;
  /** Paragraphs, in reading order. */
  readonly body: readonly Localized[];
  /** App screen that shows this lesson's idea on the user's own data. */
  readonly tryIt?: string;
}

export interface Question {
  readonly prompt: Localized;
  readonly options: readonly Localized[];
  /** Index into `options`. */
  readonly answer: number;
  readonly explanation: Localized;
}

export interface LearnModule {
  readonly id: string;
  readonly title: Localized;
  readonly summary: Localized;
  readonly lessons: readonly Lesson[];
  readonly quiz: readonly Question[];
}
