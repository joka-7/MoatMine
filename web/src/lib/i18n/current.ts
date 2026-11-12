import { translateServerText } from "./serverText";
import type { Lang } from "./translate";

/** Same key as the LanguageProvider's: the saved choice, else Hebrew for a Hebrew browser, else English. */
const KEY = "moatmine.lang";

export function currentLang(): Lang {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "en" || saved === "he") return saved;
    return window.navigator.language.toLowerCase().startsWith("he") ? "he" : "en";
  } catch {
    return "en"; // no window (server render, tests) or storage blocked
  }
}

/** An English sentence from the app or the API, in the language the user chose when we have it. */
export const serverText = (text: string): string => translateServerText(text, currentLang());

/** An error whose message the user will read: translated when raised, since the screens show `error.message` as it is. */
export const localizedError = (message: string): Error => new Error(serverText(message));
