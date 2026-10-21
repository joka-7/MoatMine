"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** What the user picked: a fixed look, or whatever the device is set to. */
export type ThemeChoice = "light" | "dark" | "system";
/** What is actually shown. */
export type Theme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];

const KEY = "moatmine.theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

export const resolveTheme = (choice: ThemeChoice, deviceIsLight: boolean): Theme =>
  choice === "system" ? (deviceIsLight ? "light" : "dark") : choice;

/** Colours for the canvas charts, which cannot read CSS variables. Mirrors the tokens in globals.css. */
export const CANVAS_COLORS: Readonly<Record<Theme, { text: string; grid: string; up: string; down: string; accent: string; accentFill: string; blue: string; upFill: string; downFill: string }>> = {
  dark: { text: "#8b909a", grid: "#1d2128", up: "#49c58c", down: "#ec6650", accent: "#e8b04a", accentFill: "232,176,74", blue: "#6aa5ff", upFill: "73,197,140", downFill: "236,102,80" },
  light: { text: "#666a73", grid: "#e8e5dc", up: "#1b7f55", down: "#c0392b", accent: "#a56a10", accentFill: "165,106,16", blue: "#2b64c4", upFill: "27,127,85", downFill: "192,57,43" },
};

export interface ThemeState {
  readonly choice: ThemeChoice;
  readonly theme: Theme;
  readonly setChoice: (choice: ThemeChoice) => void;
}

// Outside a ThemeProvider (unit tests of a single component) screens render dark, as before.
const ThemeContext = createContext<ThemeState>({
  choice: "dark",
  theme: "dark",
  setChoice: () => { throw new Error("setChoice needs a ThemeProvider above this component"); },
});

function storedChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {}
  return "dark";
}

const deviceIsLight = (): boolean => window.matchMedia?.(LIGHT_QUERY).matches ?? false;

/**
 * Holds the display theme and mirrors it onto <html data-theme>. Dark stays the default; the
 * static export is prerendered dark and the saved choice applies once the page loads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("dark");
  const [lightDevice, setLightDevice] = useState(false);

  useEffect(() => {
    setChoiceState(storedChoice());
    setLightDevice(deviceIsLight());
    const query = window.matchMedia?.(LIGHT_QUERY);
    if (!query) return;
    const onChange = (e: MediaQueryListEvent) => setLightDevice(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme = resolveTheme(choice, lightDevice);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {}
  }, []);

  const value = useMemo<ThemeState>(() => ({ choice, theme, setChoice }), [choice, theme, setChoice]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeState => useContext(ThemeContext);
