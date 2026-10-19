"use client";

import { useCallback, useEffect, useState } from "react";
import { parseProgress, recordScore, type Progress } from "./learn/progress";

const KEY = "moatmine.learn";

function stored(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

/** Quiz progress for the Learn pages, kept in this browser only. */
export function useLearnProgress(): [Progress, (moduleId: string, score: number) => void] {
  const [progress, setProgress] = useState<Progress>({});

  useEffect(() => {
    setProgress(stored());
  }, []);

  const record = useCallback((moduleId: string, score: number) => {
    setProgress((current) => {
      const next = recordScore(current, moduleId, score);
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return [progress, record];
}
