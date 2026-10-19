"use client";

import { useCallback, useEffect, useState } from "react";
import { parseProgress, setComplete, type Progress } from "./learn/progress";

const KEY = "moatmine.learn";

function stored(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

/** Which Learn modules are marked complete, kept in this browser only. */
export function useLearnProgress(): [Progress, (moduleId: string, done: boolean) => void] {
  const [progress, setProgress] = useState<Progress>([]);

  useEffect(() => {
    setProgress(stored());
  }, []);

  const mark = useCallback((moduleId: string, done: boolean) => {
    setProgress((current) => {
      const next = setComplete(current, moduleId, done);
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return [progress, mark];
}
