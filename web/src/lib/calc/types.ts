import type { Check, Intent } from "../api";

export type BookMode = "real" | "paper";

/** An account as the maths sees it; ids are numbers from the server and strings on the device. */
export interface CalcAccount {
  readonly id: number | string;
  readonly name: string;
  readonly broker: string;
  readonly currency: string;
  readonly cash: number;
}

export interface CalcHolding {
  readonly id: number | string;
  readonly account_id: number | string;
  readonly symbol: string;
  readonly quantity: number;
  readonly avg_cost: number;
  /** ISO 8601 */
  readonly opened_at: string;
}

/** The part of a quote the valuation reads. */
export interface CalcQuote {
  readonly price: number;
  readonly change: number;
  readonly change_pct: number;
}

/** The fields of a PAPI target the evaluation reads (the server's snake_case names). */
export interface CalcTarget {
  readonly id: number | string;
  readonly name: string;
  readonly symbol: string | null;
  readonly profit_target: number | null;
  readonly profit_min: number | null;
  readonly profit_max: number | null;
  readonly amount_target: number | null;
  readonly amount_min: number | null;
  readonly amount_max: number | null;
  readonly period_target_days: number | null;
  readonly period_min_days: number | null;
  readonly period_max_days: number | null;
  readonly intent: Intent;
  readonly intent_note: string;
  readonly risk_target: number | null;
  readonly risk_min: number | null;
  readonly risk_max: number | null;
}

export type { Check };
