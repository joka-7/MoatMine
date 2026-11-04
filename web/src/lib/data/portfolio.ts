import { Account, api, CheckResult, Portfolio, Quote } from "../api";
import { buildSnapshot, accountsInBook } from "../calc/portfolio";
import type { BookMode, CalcAccount, CalcHolding, CalcQuote } from "../calc/types";
import { isLocalMode } from "../localMode";
import { newId } from "../store";
import { checkOnDevice } from "./safetyCheck";
import { portfolioStore } from "../store/shared";
import type { AccountRecord, HoldingRecord, PortfolioStore } from "../store";

/** On the device only real-money accounts exist: paper trading needs the server's safety check and cash rules. */
export const LOCAL_BOOK: BookMode = "real";

export interface AccountInput {
  name: string;
  broker: string;
  currency: string;
  cash: number;
}

export interface HoldingInput {
  account_id: number | string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  /** ISO 8601; the time of adding when absent */
  opened_at?: string;
}

const toAccount = (a: AccountRecord): Account => ({ id: a.id, name: a.name, broker: a.broker, currency: a.currency, cash: a.cash });
const toCalcHolding = (h: HoldingRecord): CalcHolding => ({
  id: h.id, account_id: h.accountId, symbol: h.symbol, quantity: h.quantity, avg_cost: h.avgCost, opened_at: h.openedAt,
});

async function quoteOrUndefined(symbol: string): Promise<CalcQuote | undefined> {
  try {
    return await api<Quote>(`/stocks/${encodeURIComponent(symbol)}/quote`);
  } catch {
    return undefined; // the holding is then shown as unpriced, at cost
  }
}

/** The accounts, from this device in local mode, else from the server. */
export async function listAccounts(local: boolean): Promise<Account[]> {
  if (!local) return api<Account[]>("/accounts");
  const records = await (await portfolioStore()).list("accounts");
  return accountsInBook(records, LOCAL_BOOK).map(toAccount);
}

export async function addAccount(input: AccountInput): Promise<void> {
  if (!isLocalMode()) {
    await api("/accounts", { method: "POST", json: input });
    return;
  }
  if (input.broker === "paper") throw new Error("Paper accounts are not available while your data is kept on this device.");
  const record: Omit<AccountRecord, "updatedAt"> = { id: newId(), ...input, createdAt: new Date().toISOString() };
  await (await portfolioStore()).put("accounts", record);
}

async function removeLocalAccount(store: PortfolioStore, id: string): Promise<void> {
  const held = (await store.list("holdings")).filter((h) => h.accountId === id);
  await Promise.all(held.map((h) => store.remove("holdings", h.id)));
  await store.remove("accounts", id);
}

/** Delete an account and the positions in it. */
export async function removeAccount(id: number | string): Promise<void> {
  if (isLocalMode()) await removeLocalAccount(await portfolioStore(), String(id));
  else await api(`/accounts/${id}`, { method: "DELETE" });
}

/** Priced holdings and totals for one book. In local mode: the real-money book only, valued from this device's records. */
export async function getPortfolio(mode: BookMode, local: boolean): Promise<Portfolio> {
  if (!local) return api<Portfolio>(`/portfolio?mode=${mode}`);
  const store = await portfolioStore();
  const accounts: CalcAccount[] = accountsInBook(await store.list("accounts"), LOCAL_BOOK);
  const ids = new Set(accounts.map((a) => a.id));
  const holdings = (await store.list("holdings")).filter((h) => ids.has(h.accountId)).map(toCalcHolding);
  const symbols = [...new Set(holdings.map((h) => h.symbol))];
  const quotes = Object.fromEntries((await Promise.all(symbols.map(async (s) => [s, await quoteOrUndefined(s)] as const))).filter(([, q]) => q));
  return buildSnapshot(LOCAL_BOOK, accounts, holdings, quotes);
}

/**
 * Record a position. The safety check runs first, sized against the book as it is before the buy.
 * On the device a failed check does not stop the position being recorded (the trade already
 * happened): `check` is null and `checkError` says why.
 *
 * @throws Error when the account is not on this device.
 */
export async function addHolding(input: HoldingInput): Promise<{ check: CheckResult | null; checkError: string | null }> {
  if (!isLocalMode()) return { checkError: null, ...(await api<{ id: number; check: CheckResult }>("/holdings", { method: "POST", json: input })) };
  const store = await portfolioStore();
  const accountId = String(input.account_id);
  if (!(await store.get("accounts", accountId))) throw new Error("That account no longer exists.");
  const symbol = input.symbol.trim().toUpperCase();
  let check: CheckResult | null = null;
  let checkError: string | null = null;
  try {
    check = await checkOnDevice(symbol, input.quantity * input.avg_cost, await getPortfolio(LOCAL_BOOK, true));
  } catch (e) {
    checkError = (e as Error).message;
  }
  const record: Omit<HoldingRecord, "updatedAt"> = {
    id: newId(), accountId, symbol, quantity: input.quantity, avgCost: input.avg_cost,
    openedAt: input.opened_at ?? new Date().toISOString(),
  };
  await store.put("holdings", record);
  return { check, checkError };
}

export async function removeHolding(id: number | string): Promise<void> {
  if (isLocalMode()) await (await portfolioStore()).remove("holdings", String(id));
  else await api(`/holdings/${id}`, { method: "DELETE" });
}
