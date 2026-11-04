"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "moatmine.local";

/** True when the user chose to keep watchlist and notes on this device instead of on the server. */
export function isLocalMode(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setLocalMode(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the switch simply stays off
  }
}

/**
 * The local-mode switch. The stored choice is only readable after mount, so `ready` is false until
 * then: load nothing before it, or a local-mode user would first hit the server.
 */
export function useLocalMode(): { on: boolean; ready: boolean; choose: (on: boolean) => void } {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setOn(isLocalMode());
    setReady(true);
  }, []);
  const choose = useCallback((next: boolean) => {
    setLocalMode(next);
    setOn(next);
  }, []);
  return { on, ready, choose };
}
