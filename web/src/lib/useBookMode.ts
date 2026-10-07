"use client";

import { useCallback, useEffect, useState } from "react";

// Real-money and paper (practice) accounts are separate books; pages show one at a time.
export type BookMode = "real" | "paper";

const KEY = "moatmine.book";

function stored(): BookMode {
  try {
    return window.localStorage.getItem(KEY) === "paper" ? "paper" : "real";
  } catch {
    return "real";
  }
}

/** The book the user last picked, shared by the dashboard and the Risk page. Starts on real money. */
export function useBookMode(): [BookMode, (mode: BookMode) => void] {
  const [mode, setMode] = useState<BookMode>("real");

  useEffect(() => {
    setMode(stored());
  }, []);

  const choose = useCallback((next: BookMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {}
  }, []);

  return [mode, choose];
}
