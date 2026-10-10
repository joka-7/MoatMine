import type { Lang } from "./i18n/translate";

// Isolated left to right, so a sign or % stays on the correct side inside Hebrew text.
export const ltr = (s: string) => `⁦${s}⁩`;

export const money = (n: number | null | undefined, cur = "USD", d = 2) =>
  n == null ? "—" : ltr(new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: d, ...(d < 2 ? { minimumFractionDigits: d } : {}) }).format(n));

export const num = (n: number | null | undefined, d = 2) => (n == null ? "—" : ltr(n.toLocaleString("en-US", { maximumFractionDigits: d })));

export const pct = (n: number | null | undefined, signed = true) =>
  n == null ? "—" : ltr(`${signed && n > 0 ? "+" : ""}${n.toFixed(2)}%`);

/** A share or rate that isn't a change: "25%", "12.5%" (up to `d` decimals, no sign). */
export const share = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : ltr(`${n.toLocaleString("en-US", { maximumFractionDigits: d, useGrouping: false })}%`);

export const tone = (n: number | null | undefined) => (n == null || n === 0 ? "" : n > 0 ? "up" : "down");

export const date = (unixOrIso: number | string, lang: Lang = "en") =>
  new Date(typeof unixOrIso === "number" ? unixOrIso * 1000 : unixOrIso).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
