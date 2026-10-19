import type { LearnModule } from "./types";

/** Ids of the modules the user has marked complete. */
export type Progress = readonly string[];

export const isComplete = (module: LearnModule, progress: Progress): boolean => progress.includes(module.id);

export const completedCount = (modules: readonly LearnModule[], progress: Progress): number =>
  modules.filter((m) => isComplete(m, progress)).length;

/**
 * Reads saved progress, keeping only non-empty module ids and dropping duplicates.
 *
 * Storage is outside our control, so anything unparseable (including the quiz scores an earlier
 * version saved as an object) yields empty progress instead of an error.
 */
export function parseProgress(raw: string | null): Progress {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return [...new Set(data.filter((id): id is string => typeof id === "string" && id !== ""))];
}

/** Progress with the module marked complete, or not, leaving the other modules as they were. */
export const setComplete = (progress: Progress, moduleId: string, done: boolean): Progress =>
  done ? (progress.includes(moduleId) ? progress : [...progress, moduleId]) : progress.filter((id) => id !== moduleId);
