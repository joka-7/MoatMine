import { api, type Company } from "../api";
import { UNIVERSE, type UniverseEntry } from "./universe";

const KEY = "moatmine.screenerExtra";
/** More than this and a full run would take too long on a free data plan. */
export const MAX_CUSTOM = 100;
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,15}$/;
export const UNKNOWN = "Unknown";

const isEntry = (v: unknown): v is UniverseEntry => {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return ["symbol", "name", "sector", "industry", "country"].every((k) => typeof e[k] === "string" && (e[k] as string).length > 0) && SYMBOL.test(e["symbol"] as string);
};

/** The companies the user added to the search list; whatever in storage is not a well-formed entry is dropped. */
export function loadCustom(): UniverseEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_CUSTOM) : [];
  } catch {
    return [];
  }
}

export function saveCustom(list: readonly UniverseEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked: the additions last until the page is closed
  }
}

/**
 * The list with `entry` added.
 *
 * @throws Error when the symbol is malformed, already in the built-in or the user's list, or the limit is reached.
 */
export function withEntry(custom: readonly UniverseEntry[], entry: UniverseEntry): UniverseEntry[] {
  if (!SYMBOL.test(entry.symbol)) throw new Error(`${entry.symbol} is not a ticker symbol`);
  if ([...UNIVERSE, ...custom].some((u) => u.symbol === entry.symbol)) throw new Error(`${entry.symbol} is already in the list`);
  if (custom.length >= MAX_CUSTOM) throw new Error(`The list can hold ${MAX_CUSTOM} added companies`);
  return [...custom, entry];
}

/**
 * What the screener needs to know about a company the user adds: its name, sector, industry and
 * country, from the company profile. Any the data source does not give is "Unknown", so the company
 * can still be searched but only matches a location filter that includes "Unknown".
 *
 * @throws Error when the symbol is malformed or the data source does not know it.
 */
export async function describeCompany(rawSymbol: string): Promise<UniverseEntry> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!SYMBOL.test(symbol)) throw new Error(`${rawSymbol} is not a ticker symbol`);
  const c = await api<Company>(`/stocks/${encodeURIComponent(symbol)}/company`);
  return { symbol, name: c.name || symbol, sector: c.sector || UNKNOWN, industry: c.industry || UNKNOWN, country: c.country || UNKNOWN };
}
