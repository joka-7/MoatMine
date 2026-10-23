"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Load a resource and keep the newest result. `key` names the resource: when it changes the old
 * data is dropped, and a slower response for an older key never overwrites the current one.
 * A null `load` means nothing to fetch yet.
 */
export function useLoader<T>(load: (() => Promise<T>) | null, key: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!load);
  const latest = useRef(0);
  const shownKey = useRef<string | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const enabled = load !== null;

  const reload = useCallback(async () => {
    const run = loadRef.current;
    if (!run) return;
    const id = ++latest.current;
    if (shownKey.current !== key) {
      shownKey.current = key;
      setData(null);
      setError(null);
    }
    setLoading(true);
    try {
      const next = await run();
      if (id !== latest.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (id === latest.current) setError((e as Error).message);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (enabled) reload();
  }, [reload, enabled]);

  return { data, error, loading, reload, setData };
}
