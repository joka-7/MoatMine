import { api, apiWithHeaders, Candle, Evaluation, Target } from "../api";
import { annualVolatilityPct } from "../calc/analytics";
import { evaluateTarget } from "../calc/targets";
import type { CalcTarget } from "../calc/types";
import { isSampleData } from "../dataSource";
import { isLocalMode } from "../localMode";
import { newId } from "../store";
import { portfolioStore } from "../store/shared";
import type { TargetRecord } from "../store";
import { getPortfolio, LOCAL_BOOK } from "./portfolio";

/** What the form sends: the server's snake_case target fields, without an id. */
export type TargetInput = Omit<CalcTarget, "id">;

const DAY = 86_400;
const MIN_ORDER_FIELDS = [
  ["profit", "profit_min", "profit_max"],
  ["amount", "amount_min", "amount_max"],
  ["period", "period_min_days", "period_max_days"],
  ["risk", "risk_min", "risk_max"],
] as const;

const toTarget = (r: TargetRecord): CalcTarget & Target => ({
  id: r.id, name: r.name, symbol: r.symbol,
  profit_target: r.profitTarget, profit_min: r.profitMin, profit_max: r.profitMax,
  amount_target: r.amountTarget, amount_min: r.amountMin, amount_max: r.amountMax,
  period_target_days: r.periodTargetDays, period_min_days: r.periodMinDays, period_max_days: r.periodMaxDays,
  intent: r.intent as Target["intent"], intent_note: r.intentNote,
  risk_target: r.riskTarget, risk_min: r.riskMin, risk_max: r.riskMax,
});

function toRecord(id: string, input: TargetInput, createdAt: string): Omit<TargetRecord, "updatedAt"> {
  return {
    id, name: input.name, symbol: input.symbol ? input.symbol.trim().toUpperCase() : null,
    profitTarget: input.profit_target, profitMin: input.profit_min, profitMax: input.profit_max,
    amountTarget: input.amount_target, amountMin: input.amount_min, amountMax: input.amount_max,
    periodTargetDays: input.period_target_days, periodMinDays: input.period_min_days, periodMaxDays: input.period_max_days,
    intent: input.intent, intentNote: input.intent_note,
    riskTarget: input.risk_target, riskMin: input.risk_min, riskMax: input.risk_max, createdAt,
  };
}

/** Same rule as the server: a minimum above its maximum is an error. */
function checkOrder(input: TargetInput): void {
  for (const [dim, lo, hi] of MIN_ORDER_FIELDS) {
    const min = input[lo];
    const max = input[hi];
    if (min !== null && max !== null && min > max) throw new Error(`${dim}: min must be <= max`);
  }
}

export async function listTargets(local: boolean): Promise<Target[]> {
  if (!local) return api<Target[]>("/targets");
  const records = await (await portfolioStore()).list("targets");
  return [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toTarget);
}

/** Create a target, or replace the one with `id`. */
export async function saveTarget(input: TargetInput, id: number | string | null): Promise<void> {
  if (!isLocalMode()) {
    await api(id === null ? "/targets" : `/targets/${id}`, { method: id === null ? "POST" : "PUT", json: input });
    return;
  }
  checkOrder(input);
  if (!input.name.trim()) throw new Error("A target needs a name.");
  const store = await portfolioStore();
  const existing = id === null ? undefined : await store.get("targets", String(id));
  await store.put("targets", toRecord(existing?.id ?? newId(), input, existing?.createdAt ?? new Date().toISOString()));
}

export async function removeTarget(id: number | string): Promise<void> {
  if (isLocalMode()) await (await portfolioStore()).remove("targets", String(id));
  else await api(`/targets/${id}`, { method: "DELETE" });
}

/** Annualised volatility per symbol from a year of daily bars; null where only sample prices exist. */
async function riskBySymbol(symbols: readonly string[]): Promise<Record<string, number | null>> {
  const end = Math.floor(Date.now() / 1000);
  const entries = await Promise.all(symbols.map(async (s) => {
    try {
      const { data, headers } = await apiWithHeaders<Candle[]>(`/stocks/${encodeURIComponent(s)}/candles?resolution=D&start=${end - 365 * DAY}&end=${end}`);
      // sample bars would make target alerts fire on made-up volatility
      return [s, isSampleData(headers.get("X-Data-Source")) ? null : annualVolatilityPct(data.map((b) => b.c))] as const;
    } catch {
      return [s, null] as const;
    }
  }));
  return Object.fromEntries(entries);
}

/** Live PAPI values against MAMI bounds for every target (real money only). */
export async function evaluateTargets(local: boolean): Promise<Evaluation[]> {
  if (!local) return api<Evaluation[]>("/targets/evaluate");
  const targets = (await (await portfolioStore()).list("targets")).map(toTarget);
  const snapshot = await getPortfolio(LOCAL_BOOK, true);
  const risks = await riskBySymbol([...new Set(snapshot.holdings.map((h) => h.symbol))]);
  const now = new Date();
  return targets.map((t) => evaluateTarget(t, snapshot, risks, now));
}
