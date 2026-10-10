/** The app's display languages. Hebrew lays the page out right to left. */
export type Lang = "en" | "he";

export const LANGS: readonly Lang[] = ["en", "he"];

export const dirFor = (lang: Lang): "ltr" | "rtl" => (lang === "he" ? "rtl" : "ltr");

export type Vars = Readonly<Record<string, string | number>>;

/**
 * Fills `{name}` placeholders in a message.
 *
 * Throws when the message names a placeholder `vars` doesn't supply, so a missing value shows up
 * in tests instead of as a literal `{name}` on screen.
 */
export function fill(message: string, vars: Vars = {}): string {
  return message.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`Missing value for {${name}} in "${message}"`);
    return String(value);
  });
}
