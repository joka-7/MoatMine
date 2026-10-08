"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  // only the newest request may set state: when `path` changes (e.g. the real/paper toggle),
  // a slower response for the old path must not overwrite the new one
  const latest = useRef(0);
  const shownPath = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    const id = ++latest.current;
    if (shownPath.current !== path) {
      // a different resource (e.g. the other book): don't keep showing the old one under the new label
      shownPath.current = path;
      setData(null);
      setError(null);
    }
    setLoading(true);
    try {
      const next = await api<T>(path);
      if (id !== latest.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (id === latest.current) setError((e as Error).message);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
