import { fixed, general, groupedWhole } from "./pyformat";
import type { Rules } from "./profile";

export type Verdict = "pass" | "warn" | "block";
export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckItem {
  readonly rule: string;
  readonly status: CheckStatus;
  readonly message: string;
}

/** A stock's own safety report: the part the check reads. */
export interface SafetyReport {
  readonly score: number | null;
  readonly flags: readonly { readonly code: string }[];
}

export interface Candidate {
  readonly symbol: string;
  /** money being added */
  readonly amount: number;
  readonly sector: string | null;
  readonly price: number | null;
  readonly fair_value: number | null;
  readonly market_cap_m: number | null;
  readonly volatility_pct: number | null;
  readonly safety: SafetyReport;
}

export interface Book {
  /** holdings plus cash, before the buy */
  readonly total_value: number;
  readonly by_symbol: Readonly<Record<string, number>>;
  readonly by_sector: Readonly<Record<string, number>>;
  /** part of total_value; a buy is paid from it first */
  readonly cash: number;
  /** holdings valued at cost because no live quote came back */
  readonly unpriced: readonly string[];
}

export interface Breach {
  readonly rule: "position_size" | "sector" | "loss_limit";
  readonly subject: string;
  /** share of the book; for loss_limit the (negative) fall from the peak */
  readonly pct: number;
  readonly limit: number;
}

export function breachMessage(b: Breach): string {
  if (b.rule === "loss_limit") {
    return `Your holdings are ${fixed(-b.pct, 1)}% below their 1-year high — past your ${general(-b.limit)}% loss limit`;
  }
  return `${b.subject} is ${fixed(b.pct, 1)}% of your portfolio — above your ${general(b.limit)}% limit`;
}

/**
 * Holdings and sectors over the user's concentration limits, as a share of the whole book (cash
 * included). Holdings whose sector is unknown are not grouped into a pretend "Unknown" sector.
 */
export function portfolioBreaches(rules: Rules, book: Book): Breach[] {
  const total = book.total_value;
  if (!total) return [];
  const bySymbol = Object.entries(book.by_symbol).map(([s, v]): Breach => ({ rule: "position_size", subject: s, pct: (v / total) * 100, limit: rules.max_position_pct }));
  const bySector = Object.entries(book.by_sector).filter(([s]) => s !== "Unknown").map(([s, v]): Breach => ({ rule: "sector", subject: s, pct: (v / total) * 100, limit: rules.max_sector_pct }));
  return [...bySymbol, ...bySector].filter((b) => b.pct > b.limit);
}

/**
 * The book's current fall from its peak, if it is past the loss limit. `values` is the book's daily
 * value over the lookback window, oldest first.
 */
export function lossLimitBreach(rules: Rules, values: readonly number[]): Breach | null {
  const peak = values.length ? Math.max(...values) : 0;
  if (peak <= 0) return null;
  const fall = ((values[values.length - 1] as number) / peak - 1) * 100;
  return fall < rules.max_drawdown_pct ? { rule: "loss_limit", subject: "portfolio", pct: fall, limit: rules.max_drawdown_pct } : null;
}

const item = (rule: string, status: CheckStatus, message: string): CheckItem => ({ rule, status, message });

/**
 * The safety check for a proposed buy against the user's own rules: each rule passes, warns or
 * fails; any fail blocks, any warn marks the buy as risky.
 *
 * Twin of `check_buy` in `backend/app/safety/check.py`; `backend/tests/vectors/calc.json` checks both.
 */
export function checkBuy(rules: Rules, c: Candidate, book: Book) {
  const results: CheckItem[] = [];
  const flagCodes = new Set(c.safety.flags.map((f) => f.code));

  const score = c.safety.score;
  if (score === null) results.push(item("safety_score", "warn", "Not enough data to score this stock"));
  else if (score < rules.min_safety_score) results.push(item("safety_score", "fail", `Safety score ${score} is below your minimum ${general(rules.min_safety_score)}`));
  else results.push(item("safety_score", "pass", `Safety score ${score} (minimum ${general(rules.min_safety_score)})`));

  if (flagCodes.has("distress")) results.push(item("distress", "fail", "Bankruptcy-risk zone (Altman Z distress)"));
  if (flagCodes.has("penny") && !rules.allow_penny_stocks) results.push(item("penny", "fail", "Penny stocks are off in your risk profile"));

  // cash already counts in total_value, so only the part of the buy that cash can't cover is new money
  const afterTotal = book.total_value + c.amount - Math.min(c.amount, Math.max(book.cash, 0));
  const pos = (book.by_symbol[c.symbol] ?? 0) + c.amount;
  const posPct = afterTotal ? (pos / afterTotal) * 100 : 100;
  if (posPct > rules.max_position_pct) {
    results.push(item("position_size", "fail", `${c.symbol} would be ${fixed(posPct, 1)}% of your portfolio (limit ${general(rules.max_position_pct)}%)`));
  } else {
    results.push(item("position_size", "pass", `${c.symbol} would be ${fixed(posPct, 1)}% of your portfolio`));
  }

  if (c.sector) {
    const secPct = afterTotal ? (((book.by_sector[c.sector] ?? 0) + c.amount) / afterTotal) * 100 : 100;
    results.push(item("sector", secPct > rules.max_sector_pct ? "warn" : "pass", `${c.sector} would be ${fixed(secPct, 1)}% of your portfolio (limit ${general(rules.max_sector_pct)}%)`));
  }

  if (c.volatility_pct !== null) {
    results.push(item("volatility", c.volatility_pct > rules.max_volatility_pct ? "warn" : "pass", `Volatility ${fixed(c.volatility_pct, 0)}% a year (limit ${general(rules.max_volatility_pct)}%)`));
  }

  if (c.market_cap_m !== null && c.market_cap_m < rules.min_market_cap_m) {
    results.push(item("size", "warn", `Company is smaller than your minimum ($${groupedWhole(c.market_cap_m)}M < $${groupedWhole(rules.min_market_cap_m)}M)`));
  }

  if (c.price && c.fair_value && c.price > c.fair_value * 1.15) {
    results.push(item("valuation", "warn", `Price is ${fixed((c.price / c.fair_value - 1) * 100, 0)}% above the models' fair value`));
  }

  if (book.unpriced.length) results.push(item("prices", "warn", `No live price for ${book.unpriced.join(", ")}; sizes use what you paid`));

  const statuses = new Set(results.map((r) => r.status));
  const verdict: Verdict = statuses.has("fail") ? "block" : statuses.has("warn") ? "warn" : "pass";
  return {
    symbol: c.symbol,
    amount: Number(fixed(c.amount, 2)),
    verdict,
    risky: verdict !== "pass",
    requires_note: verdict === "warn",
    cooling_off_hours: verdict === "warn" ? rules.cooling_off_hours : 0,
    checks: results,
  };
}
