import { describe, expect, it } from "vitest";
import vectors from "../../../../backend/tests/vectors/calc.json";
import type { Portfolio } from "../api";
import { annualVolatilityPct } from "./analytics";
import { breachMessage, checkBuy, lossLimitBreach, portfolioBreaches, type Book, type Candidate } from "./check";
import { DEFAULT_RULES, levelFromAnswers, type Rules } from "./profile";
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

describe("annualVolatilityPct", () => {
  it.each(vectors.volatility.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(annualVolatilityPct(c.closes)).toEqual(c.expect);
  });
});

describe("checkBuy", () => {
  it.each(vectors.checkBuy.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(checkBuy(c.rules as Rules, c.candidate as Candidate, c.book as Book)).toEqual(c.expect);
  });
});

describe("portfolioBreaches", () => {
  it.each(vectors.portfolioBreaches.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const out = portfolioBreaches(c.rules as Rules, c.book as Book).map((b) => ({ ...b, message: breachMessage(b) }));
    expect(out).toEqual(c.expect);
  });
});

describe("lossLimitBreach", () => {
  it.each(vectors.lossLimit.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const b = lossLimitBreach(c.rules as Rules, c.values);
    expect(b && { ...b, message: breachMessage(b) }).toEqual(c.expect);
  });
});

describe("levelFromAnswers", () => {
  it.each(vectors.levelFromAnswers.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(levelFromAnswers(c.answers)).toBe(c.expect);
  });

  it.each(vectors.levelFromAnswersErrors.map((c) => [c.name, c] as const))("rejects: %s", (_name, c) => {
    expect(() => levelFromAnswers(c.answers as Record<string, number>)).toThrow(c.expect);
  });

  it("has the same default rules as the Python", () => {
    expect(DEFAULT_RULES).toEqual(vectors.defaultRules);
  });
});
