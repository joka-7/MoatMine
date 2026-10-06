export const money = (n: number | null | undefined, cur = "USD") =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);

export const num = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d }));

export const pct = (n: number | null | undefined, signed = true) =>
  n == null ? "—" : `${signed && n > 0 ? "+" : ""}${n.toFixed(2)}%`;

export const tone = (n: number | null | undefined) => (n == null || n === 0 ? "" : n > 0 ? "up" : "down");

export const date = (unixOrIso: number | string) =>
  new Date(typeof unixOrIso === "number" ? unixOrIso * 1000 : unixOrIso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
