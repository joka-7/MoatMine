"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "moatmine.intro";

function stored(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "seen";
  } catch {
    // storage blocked: treat the intro as seen, so it can't redirect on every visit
    return true;
  }
}

/**
 * Whether this browser has finished or skipped the intro tour.
 *
 * `seen` is null until storage has been read, so callers don't redirect on the first render.
 */
export function useIntroSeen(): { seen: boolean | null; markSeen: () => void } {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    setSeen(stored());
  }, []);

  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      window.localStorage.setItem(KEY, "seen");
    } catch {}
  }, []);

  return { seen, markSeen };
}
