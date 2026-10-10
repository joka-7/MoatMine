import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useI18n } from ".";

function Probe() {
  const { t, setLang } = useI18n();
  return <button type="button" onClick={() => setLang("he")}>{t("nav.settings")}</button>;
}

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("LanguageProvider", () => {
  it("starts in English and switches the texts and the page direction to Hebrew", () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByRole("button").textContent).toBe("Settings");
    expect(document.documentElement.dir).toBe("ltr");

    act(() => screen.getByRole("button").click());

    expect(screen.getByRole("button").textContent).toBe("הגדרות");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("he");
    expect(window.localStorage.getItem("moatmine.lang")).toBe("he");
  });

  it("opens in the language saved earlier", () => {
    window.localStorage.setItem("moatmine.lang", "he");
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByRole("button").textContent).toBe("הגדרות");
  });
});

describe("useI18n", () => {
  it("renders English without a provider and refuses to change language", () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.t("nav.settings")).toBe("Settings");
    expect(() => result.current.setLang("he")).toThrow("LanguageProvider");
  });
});
