import { api, CheckResult, Company, Portfolio, SafetyReport } from "../api";
import { checkBuy, type Book } from "../calc/check";
import { localRules } from "./riskProfile";

async function sectorOf(symbol: string): Promise<string | null> {
  try {
    const c = await api<Company>(`/stocks/${encodeURIComponent(symbol)}/company`);
    return c.sector || c.industry || null;
  } catch {
    return null; // an unknown sector only skips that holding's sector rule
  }
}

/** The book as the safety maths sees it (value per symbol and per sector, cash, unpriced symbols), with each symbol's sector. */
export async function bookOf(snapshot: Portfolio): Promise<{ book: Book; sectors: Record<string, string | null> }> {
  const symbols = [...new Set(snapshot.holdings.map((h) => h.symbol))].sort();
  const sectors = Object.fromEntries(await Promise.all(symbols.map(async (s) => [s, await sectorOf(s)] as const)));
  const bySymbol: Record<string, number> = {};
  const bySector: Record<string, number> = {};
  for (const h of snapshot.holdings) {
    bySymbol[h.symbol] = (bySymbol[h.symbol] ?? 0) + h.value;
    const sector = sectors[h.symbol] ?? "Unknown";
    bySector[sector] = (bySector[sector] ?? 0) + h.value;
  }
  const book: Book = { total_value: snapshot.totals.net_worth, by_symbol: bySymbol, by_sector: bySector, cash: snapshot.totals.cash, unpriced: snapshot.totals.unpriced };
  return { book, sectors };
}

/**
 * The safety check for buying `amount` of `symbol` on this device: the stock's own report comes from
 * the API by symbol, the book and the rules from the device.
 *
 * @throws Error when the stock's report cannot be fetched.
 */
export async function checkOnDevice(symbol: string, amount: number, snapshot: Portfolio): Promise<CheckResult> {
  const [report, { book }, rules] = await Promise.all([
    api<SafetyReport>(`/stocks/${encodeURIComponent(symbol)}/safety`), bookOf(snapshot), localRules(),
  ]);
  const f = report.facts;
  const num = (v: number | string | null | undefined) => (typeof v === "number" ? v : null);
  const out = checkBuy(rules, {
    symbol, amount, sector: report.sector, price: num(f["price"]), fair_value: num(f["fair_value"]),
    market_cap_m: num(f["market_cap_m"]), volatility_pct: num(f["volatility_pct"]),
    safety: { score: report.score, flags: report.flags },
  }, book);
  return { ...out, mode: "real", safety: { score: report.score, grade: report.grade, flags: report.flags } };
}
