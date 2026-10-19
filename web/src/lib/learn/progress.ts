import type { LearnModule } from "./types";

/** Best quiz score per module id. A module absent from the record has not been attempted. */
export type Progress = Readonly<Record<string, number>>;

/** Correct answers needed to complete a module: two thirds of the quiz, rounded up. */
export const passMark = (module: LearnModule): number => Math.ceil((module.quiz.length * 2) / 3);

export const isComplete = (module: LearnModule, progress: Progress): boolean => (progress[module.id] ?? 0) >= passMark(module);

export const completedCount = (modules: readonly LearnModule[], progress: Progress): number =>
  modules.filter((m) => isComplete(m, progress)).length;

/**
 * Reads saved progress, keeping only entries that are non-negative integers.
 *
 * Storage is outside our control, so anything unparseable yields empty progress instead of an error.
 */
export function parseProgress(raw: string | null): Progress {
  if (raw === null) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
  return Object.fromEntries(Object.entries(data).filter(([, v]) => Number.isInteger(v) && (v as number) >= 0)) as Progress;
}

/** Progress with `score` recorded for the module, never lowering an earlier better score. */
export const recordScore = (progress: Progress, moduleId: string, score: number): Progress =>
  ({ ...progress, [moduleId]: Math.max(progress[moduleId] ?? 0, score) });
