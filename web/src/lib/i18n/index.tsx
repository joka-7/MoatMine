"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MESSAGES, type MessageKey } from "./messages";
import { dirFor, fill, type Lang, type Vars } from "./translate";

export type { Lang, MessageKey };
export { LANGS } from "./translate";

const KEY = "moatmine.lang";

export interface I18n {
  readonly lang: Lang;
  readonly setLang: (lang: Lang) => void;
  readonly t: (key: MessageKey, vars?: Vars) => string;
}

const translator = (lang: Lang) => (key: MessageKey, vars?: Vars) => fill(MESSAGES[lang][key], vars);

// Outside a LanguageProvider (unit tests of a single component) screens render in English.
const I18nContext = createContext<I18n>({
  lang: "en",
  setLang: () => { throw new Error("setLang needs a LanguageProvider above this component"); },
  t: translator("en"),
});

/** The saved choice, else Hebrew for a browser set to Hebrew, else English. */
function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "en" || saved === "he") return saved;
  } catch {}
  return window.navigator.language.toLowerCase().startsWith("he") ? "he" : "en";
}

/** Holds the display language and mirrors it onto <html lang dir>, which flips the layout for Hebrew. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  // the static export is prerendered in English; the saved choice applies once the page loads
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => setLangState(initialLang()), []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {}
  }, []);

  const value = useMemo<I18n>(() => ({ lang, setLang, t: translator(lang) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18n => useContext(I18nContext);
