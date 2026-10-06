"use client";

// One client for web (Vercel) and desktop (Tauri): both call the Render API.
const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ls(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function apiBase(): string {
  return (ls("folio.api") || DEFAULT_API).replace(/\/$/, "");
}

// Swap this for Clerk's getToken() when AUTH_MODE=clerk on the backend.
export function authToken(): string {
  return ls("folio.token") || "dev";
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
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
      Authorization: `Bearer ${authToken()}`,
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return { data: res.status === 204 ? (undefined as T) : await res.json(), headers: res.headers };
}

// ---------- types mirrored from the API ----------

export type Quote = { symbol: string; price: number; change: number; change_pct: number; prev_close: number; ts: number };
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type NewsItem = { headline: string; summary: string; url: string; source: string; datetime: number; image: string };
export type Account = { id: number; name: string; broker: string; currency: string; cash: number };
export type HoldingRow = {
  id: number; account_id: number; symbol: string; quantity: number; avg_cost: number; price: number;
  value: number; cost: number; pnl: number; pnl_pct: number; day_change_pct: number; weight_pct: number;
  opened_at: string; stale: boolean;
};
export type Portfolio = {
  accounts: Account[];
  holdings: HoldingRow[];
  totals: { cash: number; invested_value: number; net_worth: number; cost: number; pnl: number; pnl_pct: number; day_change: number };
};
export type WatchRow = { id: number; symbol: string; note: string; alert_above: number | null; alert_below: number | null; quote: Quote | null };
export type Note = { id: number; symbol: string; kind: "note" | "news" | "thesis" | "link"; title: string; body: string; url: string; created_at: string };

export type Intent = "growth" | "income" | "speculation" | "hedge" | "retirement" | "custom";
export type Target = {
  id: number; name: string; symbol: string | null;
  profit_target: number | null; profit_min: number | null; profit_max: number | null;
  amount_target: number | null; amount_min: number | null; amount_max: number | null;
  period_target_days: number | null; period_min_days: number | null; period_max_days: number | null;
  intent: Intent; intent_note: string;
  risk_target: number | null; risk_min: number | null; risk_max: number | null;
};
export type CheckStatus = "ok" | "reached" | "below_min" | "above_max" | "unset" | "no_data";
export type Check = { value: number | null; target: number | null; min: number | null; max: number | null; status: CheckStatus; progress_pct: number | null };
export type Evaluation = {
  target_id: number; name: string; symbol: string | null; breaches: string[];
  checks: { profit: Check; amount: Check; period: Check; intent: Check & { intent: Intent; note: string } };
};
export type Alert = { id: number; source: string; symbol: string | null; message: string; read: boolean; created_at: string };
export type Ratios = { fundamental: Record<string, number | null>; price: Record<string, number | null> };
export type ChatMsg = { role: "user" | "assistant"; content: string; meta?: string };
export type ModelChoice = { id: string; label: string; available: boolean };
