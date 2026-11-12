import { localizedError } from "../i18n/current";
import { api, BuyPlan, CheckResult, Quote } from "../api";
import { fixed, general } from "../calc/pyformat";
import { pyRound } from "../calc/round";
import { isLocalMode } from "../localMode";
import { newId } from "../store";
import { portfolioStore } from "../store/shared";
import type { JsonObject, NoteRecord, PlanRecord } from "../store";
import { getPortfolio, LOCAL_BOOK } from "./portfolio";
import { checkOnDevice } from "./safetyCheck";

/** A written reason must be at least this long before a risky buy can be planned. */
const MIN_NOTE_CHARS = 20;

export interface PlanInput {
  account_id: number | string;
  symbol: string;
  quantity: number;
  note: string;
}

const quoteOf = (symbol: string): Promise<Quote> => api<Quote>(`/stocks/${encodeURIComponent(symbol)}/quote`);

/**
 * The safety check for buying `quantity` shares: on the server for the chosen book, or on the
 * device for the real-money book. Sized at the live price.
 */
export async function checkQuantity(symbol: string, quantity: number, paper: boolean, local: boolean): Promise<CheckResult> {
  if (!local) return api<CheckResult>("/safety/check", { method: "POST", json: { symbol, quantity, mode: paper ? "paper" : "real" } });
  const { price } = await quoteOf(symbol);
  return { ...(await checkOnDevice(symbol, quantity * price, await getPortfolio(LOCAL_BOOK, true))), price };
}

/** The plan as the page shows it: a cooling-off plan whose wait is over reads as ready. */
function toPlan(p: PlanRecord, now: Date): BuyPlan {
  const status = p.status === "cooling_off" && Date.parse(p.availableAt) <= now.getTime() ? "ready" : p.status;
  return {
    id: p.id, account_id: p.accountId, symbol: p.symbol, quantity: p.quantity, price: p.price, amount: pyRound(p.quantity * p.price),
    note: p.note, verdict: p.verdict as BuyPlan["verdict"], status: status as BuyPlan["status"], available_at: p.availableAt,
    created_at: p.createdAt, check: p.check as unknown as CheckResult, executed_holding_id: p.executedHoldingId,
  } as unknown as BuyPlan;
}

async function ownPlan(id: number | string): Promise<PlanRecord> {
  const plan = await (await portfolioStore()).get("plans", String(id));
  if (!plan) throw localizedError("plan not found");
  return plan;
}

const savePlan = async (p: Omit<PlanRecord, "updatedAt">): Promise<PlanRecord> => (await portfolioStore()).put("plans", p);

/** Newest first, at most 100. */
export async function listPlans(local: boolean): Promise<BuyPlan[]> {
  if (!local) return api<BuyPlan[]>("/plans");
  const now = new Date();
  const records = await (await portfolioStore()).list("plans");
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map((p) => toPlan(p, now));
}

/**
 * Check a buy and record the plan: blocked, cooling off (a risky buy waits), or ready.
 *
 * @throws Error when the account is not here, or a risky buy has no written reason of 20 or more characters.
 */
export async function createPlan(input: PlanInput): Promise<BuyPlan> {
  if (!isLocalMode()) return api<BuyPlan>("/plans", { method: "POST", json: input });
  const store = await portfolioStore();
  if (!(await store.get("accounts", String(input.account_id)))) throw localizedError("account not found");
  const symbol = input.symbol.trim().toUpperCase();
  const { price } = await quoteOf(symbol);
  const check = await checkOnDevice(symbol, input.quantity * price, await getPortfolio(LOCAL_BOOK, true));
  if (check.requires_note && input.note.trim().length < MIN_NOTE_CHARS) {
    throw localizedError(`This buy breaks some of your rules. Write why you still want it (${MIN_NOTE_CHARS}+ characters).`);
  }
  const now = new Date();
  let status: PlanRecord["status"] = "ready";
  let available = now;
  if (check.verdict === "block") status = "blocked";
  else if (check.verdict === "warn" && check.cooling_off_hours) {
    status = "cooling_off";
    available = new Date(now.getTime() + check.cooling_off_hours * 3_600_000);
  }
  const saved = await savePlan({
    id: newId(), accountId: String(input.account_id), symbol, quantity: input.quantity, price, note: input.note.trim(),
    verdict: check.verdict, check: check as unknown as JsonObject, status, availableAt: available.toISOString(),
    createdAt: now.toISOString(), executedHoldingId: null,
  });
  return toPlan(saved, now);
}

/**
 * A plan approved as `pass` that now breaks a rule gets the note and cooling-off a warn plan needs.
 * Returns the plan, now marked warn, if it may go ahead right away.
 *
 * @throws Error when the plan has no written reason (it is cancelled) or has to wait (it is cooling off).
 */
async function sendBackThroughWarnFlow(p: PlanRecord, recheck: CheckResult, now: Date): Promise<PlanRecord> {
  const warned = { ...p, verdict: "warn", check: recheck as unknown as JsonObject };
  if (p.note.trim().length < MIN_NOTE_CHARS) {
    await savePlan({ ...warned, status: "cancelled" });
    throw localizedError("This buy now breaks some of your rules. Make a new plan and write why you still want it.");
  }
  const hours = recheck.cooling_off_hours;
  if (hours) {
    await savePlan({ ...warned, status: "cooling_off", availableAt: new Date(now.getTime() + hours * 3_600_000).toISOString() });
    throw localizedError(`This buy now breaks some of your rules, so it waits ${hours}h before it can run.`);
  }
  return warned;
}

async function executeClaimed(claimed: PlanRecord, now: Date): Promise<BuyPlan> {
  let p = claimed;
  const store = await portfolioStore();
  // prices and the portfolio may have moved during cooling-off
  const { price } = await quoteOf(p.symbol);
  const recheck = await checkOnDevice(p.symbol, p.quantity * price, await getPortfolio(LOCAL_BOOK, true));
  if (recheck.verdict === "block") {
    await savePlan({ ...p, status: "blocked", verdict: "block", check: recheck as unknown as JsonObject });
    throw localizedError("The buy no longer passes your rules.");
  }
  if (recheck.verdict === "warn" && p.verdict !== "warn") p = await sendBackThroughWarnFlow(p, recheck, now);
  const holdingId = newId();
  await store.put("holdings", { id: holdingId, accountId: p.accountId, symbol: p.symbol, quantity: p.quantity, avgCost: price, openedAt: now.toISOString() });
  if (p.note) {
    const note: Omit<NoteRecord, "updatedAt"> = {
      id: newId(), symbol: p.symbol, kind: "thesis", title: `Why I bought (${general(p.quantity)} @ ${fixed(price, 2)})`, body: p.note, url: "", createdAt: now.toISOString(),
    };
    await store.put("notes", note);
  }
  return toPlan(await savePlan({ ...p, status: "executed", price, executedHoldingId: holdingId }), now);
}

/**
 * Run a ready plan: re-check the buy against today's price and rules, then record the position.
 *
 * @throws Error when the plan is not ready, or the buy no longer passes the rules.
 */
export async function executePlan(id: number | string): Promise<BuyPlan> {
  if (!isLocalMode()) return api<BuyPlan>(`/plans/${id}/execute`, { method: "POST" });
  const now = new Date();
  const plan = await ownPlan(id);
  const shown = toPlan(plan, now);
  if (shown.status !== "ready") {
    throw localizedError(`plan is ${shown.status}` + (shown.status === "cooling_off" ? ` until ${shown.available_at}` : ""));
  }
  const observed = plan.status;
  const claimed = await savePlan({ ...plan, status: "executing" });
  try {
    return await executeClaimed(claimed, now);
  } catch (e) {
    // release the claim unless the attempt already moved the plan to a final state
    const current = await ownPlan(id);
    if (current.status === "executing") await savePlan({ ...current, status: observed });
    throw e;
  }
}

export async function cancelPlan(id: number | string): Promise<BuyPlan> {
  if (!isLocalMode()) return api<BuyPlan>(`/plans/${id}/cancel`, { method: "POST" });
  const plan = await ownPlan(id);
  if (plan.status === "executed") throw localizedError("already executed");
  return toPlan(await savePlan({ ...plan, status: "cancelled" }), new Date());
}
