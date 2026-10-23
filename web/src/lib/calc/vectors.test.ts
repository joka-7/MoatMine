import { describe, expect, it } from "vitest";
import vectors from "../../../../backend/tests/vectors/calc.json";
import type { Portfolio } from "../api";
import { buildSnapshot } from "./portfolio";
import { checkBound, evaluateTarget } from "./targets";
import type { CalcAccount, CalcHolding, CalcQuote, CalcTarget } from "./types";

// The same vectors drive backend/tests/test_calc_vectors.py: both implementations must produce `expect`.
const snapshots = new Map(vectors.snapshot.map((c) => [c.name, c.expect as unknown as Portfolio]));

describe("checkBound", () => {
  it.each(vectors.checkBound.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(checkBound(c.value, c.target, c.min, c.max)).toEqual(c.expect);
  });
});

describe("buildSnapshot", () => {
  it.each(vectors.snapshot.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const out = buildSnapshot(c.mode as "real" | "paper", c.accounts as CalcAccount[], c.holdings as CalcHolding[], c.quotes as Record<string, CalcQuote>);
    expect(out).toEqual(c.expect);
  });
});

describe("evaluateTarget", () => {
  it.each(vectors.evaluate.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const snapshot = snapshots.get(c.snapshot);
    if (!snapshot) throw new Error(`no snapshot vector named ${c.snapshot}`);
    const target = { profit_target: null, profit_min: null, profit_max: null, amount_target: null, amount_min: null, amount_max: null,
      period_target_days: null, period_min_days: null, period_max_days: null, risk_target: null, risk_min: null, risk_max: null,
      ...c.target } as CalcTarget;
    expect(evaluateTarget(target, snapshot, c.risks as Record<string, number | null>, new Date(c.now))).toEqual(c.expect);
  });
});
