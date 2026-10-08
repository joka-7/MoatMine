"use client";

import { getToken } from "@clerk/nextjs";
import type { AgentConfig, ExternalChatProviderId } from "modeldispatcher-browser-agent";
import type { components } from "./api-schema";

// One client for web (Vercel) and desktop (Tauri): both call the Render API.
const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Set → sign in with Clerk (backend AUTH_MODE=clerk). Unset → local dev mode (backend AUTH_MODE=dev).
export const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

function ls(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function apiBase(): string {
  return (ls("moatmine.api") || DEFAULT_API).replace(/\/$/, "");
}

/** Local dev mode only: the backend trusts this string as the user id. */
export function devToken(): string {
  return ls("moatmine.token") || "dev";
}

/** Bearer token for the API: the Clerk session JWT when Clerk is configured, else the dev user id. */
export async function authToken(): Promise<string> {
  if (!CLERK_PUBLISHABLE_KEY) return devToken();
  const token = await getToken();
  if (!token) throw new ApiError(401, "Sign in to continue.");
  return token;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  return (await apiWithHeaders<T>(path, init)).data;
}

export async function apiWithHeaders<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ data: T; headers: Headers }> {
  const { json, headers, ...rest } = init;
  const res = await fetch(apiBase() + path, {
    ...rest,
    headers: {
      Authorization: `Bearer ${await authToken()}`,
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let msg = res.statusText;
    let detail: unknown;
    try {
      const body = await res.json();
      const d = body.detail;
      detail = d;
      msg = typeof d === "string" ? d : typeof d?.message === "string" ? d.message
        : typeof d?.detail === "string" ? d.detail : JSON.stringify(d ?? body);
    } catch {}
    throw new ApiError(res.status, msg, detail);
  }
  return { data: res.status === 204 ? (undefined as T) : await res.json(), headers: res.headers };
}

// ---------- types mirrored from the API ----------
// Routes with a response model take their types from api-schema.ts, generated from the API's
// OpenAPI schema (npm run gen:api; CI fails on drift). The rest are still mirrored by hand.

type Schemas = components["schemas"];

export type Quote = Schemas["QuoteOut"];
export type Candle = Schemas["CandleOut"];
export type NewsItem = { headline: string; summary: string; url: string; source: string; datetime: number; image: string };
export type Account = Schemas["AccountOut"];
export type HoldingRow = {
  id: number; account_id: number; symbol: string; quantity: number; avg_cost: number; price: number;
  value: number; cost: number; pnl: number; pnl_pct: number; day_change_pct: number; weight_pct: number;
  opened_at: string; stale: boolean;
};
export type Portfolio = {
  mode: "real" | "paper";
  accounts: Account[];
  holdings: HoldingRow[];
  totals: { cash: number; invested_value: number; net_worth: number; cost: number; pnl: number; pnl_pct: number; day_change: number; unpriced: string[] };
};
export type WatchRow = { id: number; symbol: string; note: string; alert_above: number | null; alert_below: number | null; quote: Quote | null };
export type Note = Schemas["NoteOut"];

export type Intent = "growth" | "income" | "speculation" | "hedge" | "retirement" | "custom";
export type Target = Schemas["TargetOut"];
export type CheckStatus = "ok" | "reached" | "below_min" | "above_max" | "unset" | "no_data";
export type Check = { value: number | null; target: number | null; min: number | null; max: number | null; status: CheckStatus; progress_pct: number | null };
export type Evaluation = {
  target_id: number; name: string; symbol: string | null; breaches: string[];
  checks: { profit: Check; amount: Check; period: Check; intent: Check & { intent: Intent; note: string } };
};
export type Alert = Schemas["AlertOut"];
export type Ratios = Schemas["RatiosOut"];
export type ChatMsg = { role: "user" | "assistant"; content: string; meta?: string };
export type ModelChoice = Schemas["ModelChoiceOut"];

// ---------- research ----------

export type Company = {
  symbol: string; name: string; industry: string; sector?: string; exchange: string; currency: string; logo: string;
  market_cap: number | null; description?: string; website?: string; employees?: number | null; ceo?: string;
  country?: string; ipo?: string;
};
export type Earning = { period: string; actual: number | null; estimate: number | null; surprise_pct: number | null };
export type Recommendation = { period: string; strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number };
export type PriceTarget = { high: number | null; low: number | null; mean: number | null; median: number | null; updated: string; upside_pct?: number };
export type Analysts = { recommendations: Recommendation[]; price_target: PriceTarget | null; price: number };
export type Dividends = { dividends: { date: string; amount: number | null }[]; splits: { date: string; ratio: string }[] };

export type ValModel = { key: string; name: string; value: number | null; formula: string; skipped: string | null; upside_pct: number | null };
export type Valuation = {
  symbol: string; price: number; data_source: string; disclaimer: string;
  assumptions: Record<string, number | string | null> & { growth_source: string };
  inputs: Record<string, number | null>;
  models: ValModel[];
  summary: { fair_value: number | null; low: number | null; high: number | null; models_used: number; buy_below: number | null; upside_pct: number | null; verdict: string };
  indicators: Record<string, number | null>;
  quality: {
    piotroski: { score: number | null; band?: string; checks: { name: string; pass: boolean }[]; skipped: string | null };
    altman_z: { score: number | null; zone: "safe" | "grey" | "distress" | null; skipped: string | null };
  };
};
export type NewsSummary = { symbol: string; summary: string; sentiment: "bullish" | "neutral" | "bearish" | "mixed" | "unknown"; points: string[]; watch: string; model?: string; count: number; cached?: boolean };
export type FeedItem = NewsItem & { symbol: string; held: boolean };

export type CrisisStats = {
  start_price: number; drawdown_pct: number; trough_date: string; window_return_pct: number;
  recovered: boolean; recovery_date: string | null; recovery_days: number | null; still_below_pct: number | null;
};
export type BadTimes = {
  symbol: string; benchmark: string; history_from: string | null; data_source: string; note: string;
  crises: { key: string; name: string; start: string; end: string; description: string; stock: CrisisStats | null; benchmark: CrisisStats | null }[];
  resilience: { downside_capture_pct: number | null; label: string; crises_covered: number; recovered_count?: number; avg_drawdown_pct?: number; avg_benchmark_drawdown_pct?: number };
  worst_drawdowns: { peak_date: string; trough_date: string; depth_pct: number; fall_days: number; recovery_date: string | null; recovery_days: number | null; recovered: boolean }[];
};

// ---------- safety ----------

export type Grade = "A" | "B" | "C" | "D" | "F";
export type SafetyFlag = Schemas["SafetyFlagOut"];
export type SafetyArea = { key: string; name: string; score: number | null; grade: Grade | null; weight: number };
export type SafetyReport = {
  symbol: string; score: number | null; grade: Grade | null; coverage_pct: number; sector: string | null; data_source: string;
  components: { name: string; max: number; points: number | null; value: unknown; note: string }[];
  areas: SafetyArea[];
  analysis: { verdict: string; strengths: string[]; weaknesses: string[]; missing: string[]; summary: string };
  flags: SafetyFlag[];
  facts: Record<string, number | string | null>;
  moat: MoatMetrics | null;
};
export type MoatMetrics = {
  years: number; roic_avg_pct: number | null; roic_consistency: number | null; gross_margin_avg_pct: number | null;
  gross_margin_std_pp: number | null; revenue_cagr_pct: number | null; growth_consistency: number | null;
  series: { year: number; roic_pct: number | null; gross_margin_pct: number | null; revenue: number }[];
};
export type SafetyAnalysis = { symbol: string; overview: string; areas: { name: string; comment: string }[]; fit: string; improve: string; model: string };
export type CheckItem = Schemas["CheckItemOut"];
export type CheckResult = Schemas["CheckResultOut"];
export type RiskRules = {
  max_position_pct: number; max_sector_pct: number; min_safety_score: number; max_volatility_pct: number;
  max_drawdown_pct: number; min_market_cap_m: number; allow_penny_stocks: boolean; cooling_off_hours: number;
};
export type RiskLevel = "conservative" | "moderate" | "balanced" | "growth";
export type RiskProfile = RiskRules & { saved: boolean; level: RiskLevel; answers: Record<string, number>; paper_mode: boolean };
export type Question = { id: string; text: string; options: string[] };
export type PortfolioRisk = {
  mode: "real" | "paper";
  uncovered_pct: number; uncovered_symbols: string[]; window_limited_by: string | null;
  total_value: number; invested_value: number; cash_pct: number; days: number; volatility_pct: number | null; beta: number | null;
  var95_1d: number | null; var95_1m: number | null; max_drawdown_pct: number | null; top_position_pct: number | null;
  effective_holdings: number | null; holdings_count: number; sectors: Record<string, number>;
  correlation: { symbols: string[]; matrix: (number | null)[][] }; avg_correlation: number | null;
  breaches: { rule: string; subject: string; message: string }[]; rules: RiskRules; data_source: string;
};
export type StressScenario = {
  key: string; name: string; kind: "historical" | "hypothetical"; change: number; change_pct: number; breaches_limit: boolean;
  worst: { symbol: string; change_pct: number; change: number; basis: string }[];
};
export type StressReport = { mode: "real" | "paper"; total_value: number; loss_limit_pct: number; scenarios: StressScenario[]; note: string; data_source: string };
export type BuyPlan = Schemas["PlanOut"];

// ---------- AI settings (ModelDispatcher AgentConfig shape) ----------


export type ExternalAgent = { base_url: string; model: string; api_key: string };
export type AiSettings = {
  config: AgentConfig;
  favorite: ExternalChatProviderId | null;
  external: ExternalAgent | null;
  supported: string[];
  server_vendors: string[];
};
/** Error body from ModelDispatcher (e.g. quota_exceeded with action trigger_key_wizard). */
export type DispatcherErrorBody = { error: string; detail?: string; action?: string; provider?: string };
