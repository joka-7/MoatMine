import spec from "./serverText.he.json";
import type { Lang } from "./translate";

// The API sends some sentences in English (safety flags, check results, crisis names, alert text,
// error messages). The Hebrew screens translate them here by matching them against
// serverText.he.json: whole sentences first, then templates with placeholders for the numbers and
// names. A sentence nobody has translated is shown as it came: English, never an error.
// backend/tests/test_server_text.py fails when the API produces a sentence this file cannot match,
// and backend/tests/vectors/server_text.json pins the matching rules for both languages.

interface Template {
  readonly re: RegExp;
  readonly he: string;
}

const NUMBER = String.raw`(-?\d[\d,]*\.?\d*)`;
const exact: Readonly<Record<string, string>> = spec.exact;

/** `{}` is any text, `{n}` a number, `{a|b}` one of the words; everything else matches itself. */
function compile(pattern: string): RegExp {
  const body = pattern.split(/(\{[^}]*\})/).map((part) => {
    if (!part.startsWith("{")) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const inner = part.slice(1, -1);
    if (inner === "") return "(.+?)";
    if (inner === "n") return NUMBER;
    return `(${inner.split("|").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;
  }).join("");
  return new RegExp(`^${body}$`);
}

const templates: readonly Template[] = spec.patterns.map((p) => ({ re: compile(p.en), he: p.he }));

const lookup = (text: string): string | undefined =>
  exact[text] ?? (/^[a-z]/.test(text) ? exact[text.charAt(0).toUpperCase() + text.slice(1)] : undefined);

/** Splits `text` on `separator`, translates every part, and keeps the result only if some part changed. */
function viaParts(text: string, separator: RegExp, joiner: string): string | null {
  const parts = text.split(separator);
  if (parts.length < 2) return null;
  const translated = parts.map(translateHe);
  return translated.some((t, i) => t !== parts[i]) ? translated.join(joiner) : null;
}

function translateHe(text: string): string {
  const known = lookup(text);
  if (known !== undefined) return known;
  const sentences = viaParts(text, /(?<=\.)\s+(?=[A-Z])/, " ");
  if (sentences !== null) return sentences;
  for (const t of templates) {
    const m = t.re.exec(text);
    if (m) return t.he.replace(/\{(\d+)\}/g, (_, i: string) => translateHe(m[Number(i)] ?? ""));
  }
  return viaParts(text, /; /, "; ") ?? viaParts(text, /, /, ", ") ?? text;
}

/** `text` as the user's language should show it. English is returned as it is. */
export function translateServerText(text: string, lang: Lang): string {
  return lang === "he" ? translateHe(text) : text;
}
