import { api, RiskProfile, RiskRules } from "../api";
import { DEFAULT_RULES, levelFromAnswers, LEVELS, RULE_KEYS, type Level, type Rules } from "../calc/profile";
import { isLocalMode } from "../localMode";
import { newId, SINGLETON_ID } from "../store";
import { portfolioStore } from "../store/shared";
import type { RiskProfileRecord, TargetRecord } from "../store";

/** Name of the portfolio target that mirrors the profile's volatility limit. */
export const AUTO_TARGET = "Risk profile (auto)";

/** What the profile form sends. Send `answers` or `level`; the rule fields override that level's defaults. */
export interface ProfileInput extends Partial<Rules> {
  answers?: Record<string, number>;
  level?: string;
  paper_mode: boolean;
}

/** Range of each rule the user may set, as on the server. [min, max, min exclusive?, max exclusive?] */
const LIMITS: Readonly<Record<Exclude<keyof Rules, "allow_penny_stocks">, readonly [number, number, boolean, boolean]>> = {
  max_position_pct: [0, 100, true, false],
  max_sector_pct: [0, 100, true, false],
  min_safety_score: [0, 100, false, false],
  max_volatility_pct: [0, 300, true, false],
  max_drawdown_pct: [-100, 0, false, true],
  min_market_cap_m: [0, Number.POSITIVE_INFINITY, false, false],
  cooling_off_hours: [0, 720, false, false],
};

const unsaved = (): RiskProfile => ({ saved: false, level: "moderate", answers: {}, paper_mode: true, ...DEFAULT_RULES.moderate });

function toProfile(r: RiskProfileRecord): RiskProfile {
  return {
    saved: true, level: r.level as Level, answers: r.answers as Record<string, number>, paper_mode: r.paperMode,
    max_position_pct: r.maxPositionPct, max_sector_pct: r.maxSectorPct, min_safety_score: r.minSafetyScore,
    max_volatility_pct: r.maxVolatilityPct, max_drawdown_pct: r.maxDrawdownPct, min_market_cap_m: r.minMarketCapM,
    allow_penny_stocks: r.allowPennyStocks, cooling_off_hours: r.coolingOffHours,
  };
}

/** The risk profile, from this device in local mode, else from the server. The defaults for "moderate" if none is saved. */
export async function getProfile(local: boolean): Promise<RiskProfile> {
  if (!local) return api<RiskProfile>("/safety/profile");
  const record = await (await portfolioStore()).get("riskProfile", SINGLETON_ID);
  return record ? toProfile(record) : unsaved();
}

/** The rules the safety check applies on this device. */
export async function localRules(): Promise<Rules> {
  const p = await getProfile(true);
  return Object.fromEntries(RULE_KEYS.map((k) => [k, p[k]])) as unknown as Rules;
}

function checkOverrides(overrides: Partial<Rules>): void {
  for (const [key, [lo, hi, loOpen, hiOpen]] of Object.entries(LIMITS)) {
    const v = overrides[key as keyof typeof LIMITS];
    if (v === undefined) continue;
    const ok = (loOpen ? v > lo : v >= lo) && (hiOpen ? v < hi : v <= hi);
    if (!ok) throw new Error(`${key} is out of range`);
  }
}

async function syncAutoTarget(profile: RiskProfile): Promise<void> {
  const store = await portfolioStore();
  const existing = (await store.list("targets")).find((t) => t.name === AUTO_TARGET);
  const base: Omit<TargetRecord, "updatedAt"> = existing ?? {
    id: newId(), name: AUTO_TARGET, symbol: null, profitTarget: null, profitMin: null, profitMax: null,
    amountTarget: null, amountMin: null, amountMax: null, periodTargetDays: null, periodMinDays: null, periodMaxDays: null,
    intent: "growth", intentNote: "", riskTarget: null, riskMin: null, riskMax: null, createdAt: new Date().toISOString(),
  };
  await store.put("targets", {
    ...base,
    riskMax: profile.max_volatility_pct,
    intent: profile.level === "conservative" ? "retirement" : "growth",
    intentNote: `From your ${profile.level} risk profile. Edit the profile, not this target.`,
  });
}

/**
 * Save the risk profile and mirror its volatility limit into a portfolio target.
 *
 * @throws Error when neither answers nor a level is given, an answer is invalid, or a rule is out of range.
 */
export async function saveProfile(input: ProfileInput): Promise<RiskProfile> {
  if (!isLocalMode()) {
    return api<RiskProfile>("/safety/profile", { method: "PUT", json: input });
  }
  const { answers, level: chosen, paper_mode, ...overrides } = input;
  const level = answers ? levelFromAnswers(answers) : chosen;
  if (!level) throw new Error("send questionnaire answers or a level");
  if (!(LEVELS as readonly string[]).includes(level)) throw new Error(`level must be one of ${LEVELS.join(", ")}`);
  const defined = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined && v !== null)) as Partial<Rules>;
  checkOverrides(defined);
  const rules: Rules = { ...DEFAULT_RULES[level as Level], ...defined };
  const record: Omit<RiskProfileRecord, "updatedAt"> = {
    id: SINGLETON_ID, level, answers: answers ?? {}, paperMode: paper_mode,
    maxPositionPct: rules.max_position_pct, maxSectorPct: rules.max_sector_pct, minSafetyScore: rules.min_safety_score,
    maxVolatilityPct: rules.max_volatility_pct, maxDrawdownPct: rules.max_drawdown_pct, minMarketCapM: rules.min_market_cap_m,
    allowPennyStocks: rules.allow_penny_stocks, coolingOffHours: rules.cooling_off_hours,
  };
  const saved = toProfile(await (await portfolioStore()).put("riskProfile", record));
  await syncAutoTarget(saved);
  return saved;
}

export type { RiskRules };
