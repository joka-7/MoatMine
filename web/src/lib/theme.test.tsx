import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeSwitch from "@/components/ThemeSwitch";
import { resolveTheme, ThemeProvider, useTheme } from "./theme";

type Listener = (e: { matches: boolean }) => void;

/** A controllable matchMedia: `lightDevice` is what the device prefers; flipping it notifies listeners. */
function fakeDevice(lightDevice: boolean) {
  const listeners = new Set<Listener>();
  let light = lightDevice;
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return light; },
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }));
  return (next: boolean) => { light = next; listeners.forEach((l) => l({ matches: next })); };
}

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("resolveTheme", () => {
  it.each([
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", true, "dark"],
    ["dark", false, "dark"],
    ["system", true, "light"],
    ["system", false, "dark"],
  ] as const)("choice %s on a device that prefers light=%s shows %s", (choice, light, expected) => {
    expect(resolveTheme(choice, light)).toBe(expected);
  });
});

describe("ThemeProvider", () => {
  it.each([
    ["nothing saved", null, "dark"],
    ["an unknown value", "sepia", "dark"],
    ["light", "light", "light"],
    ["system on a light device", "system", "light"],
  ])("starts from %s as %s", (_, saved, expected) => {
    fakeDevice(true);
    if (saved !== null) window.localStorage.setItem("moatmine.theme", saved);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe(saved === null || saved === "sepia" ? "dark" : expected);
    expect(document.documentElement.dataset.theme).toBe(result.current.theme);
  });

  it("saves a new choice, applies it to <html>, and remembers it for the next visit", () => {
    fakeDevice(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setChoice("light"));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("moatmine.theme")).toBe("light");
    expect(renderHook(() => useTheme(), { wrapper }).result.current.choice).toBe("light");
  });

  it("follows the device while 'system' is chosen, and ignores it for a fixed choice", () => {
    const setDevice = fakeDevice(false);
    window.localStorage.setItem("moatmine.theme", "system");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
    act(() => setDevice(true));
    expect(result.current.theme).toBe("light");
    act(() => result.current.setChoice("dark"));
    act(() => setDevice(false));
    act(() => setDevice(true));
    expect(result.current.theme).toBe("dark");
  });
});

describe("ThemeSwitch", () => {
  it("marks the current choice and switches the page when another is picked", () => {
    fakeDevice(false);
    render(<ThemeProvider><ThemeSwitch /></ThemeProvider>);
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(screen.getByRole("button", { name: "Light" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
