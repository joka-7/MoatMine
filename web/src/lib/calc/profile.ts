export const LEVELS = ["conservative", "moderate", "balanced", "growth"] as const;
export type Level = (typeof LEVELS)[number];

export const RULE_KEYS = [
  "max_position_pct", "max_sector_pct", "min_safety_score", "max_volatility_pct",
  "max_drawdown_pct", "min_market_cap_m", "allow_penny_stocks", "cooling_off_hours",
] as const;

/** The user's own risk rules. */
export interface Rules {
  readonly max_position_pct: number;
  readonly max_sector_pct: number;
  readonly min_safety_score: number;
  readonly max_volatility_pct: number;
  readonly max_drawdown_pct: number;
  readonly min_market_cap_m: number;
  readonly allow_penny_stocks: boolean;
  readonly cooling_off_hours: number;
}

export const DEFAULT_RULES: Readonly<Record<Level, Rules>> = {
  conservative: { max_position_pct: 5, max_sector_pct: 20, min_safety_score: 70, max_volatility_pct: 25, max_drawdown_pct: -15, min_market_cap_m: 10_000, allow_penny_stocks: false, cooling_off_hours: 48 },
  moderate: { max_position_pct: 8, max_sector_pct: 25, min_safety_score: 60, max_volatility_pct: 35, max_drawdown_pct: -20, min_market_cap_m: 2_000, allow_penny_stocks: false, cooling_off_hours: 24 },
  balanced: { max_position_pct: 10, max_sector_pct: 30, min_safety_score: 50, max_volatility_pct: 45, max_drawdown_pct: -25, min_market_cap_m: 1_000, allow_penny_stocks: false, cooling_off_hours: 24 },
  growth: { max_position_pct: 15, max_sector_pct: 40, min_safety_score: 40, max_volatility_pct: 60, max_drawdown_pct: -35, min_market_cap_m: 300, allow_penny_stocks: false, cooling_off_hours: 12 },
};

const QUESTION_IDS = ["horizon", "drop", "goal", "experience", "income"] as const;

/**
 * The risk level for questionnaire answers (each the option index 0 to 3). A short horizon or
 * "sell everything" caps it at conservative.
 *
 * Twin of `level_from_answers` in `backend/app/safety/profile.py`; `backend/tests/vectors/calc.json` checks both.
 *
 * @throws Error when an answer is missing or outside 0 to 3.
 */
export function levelFromAnswers(answers: Readonly<Record<string, number>>): Level {
  const missing = QUESTION_IDS.filter((id) => answers[id] === undefined);
  if (missing.length) throw new Error(`missing answers: ${missing.join(", ")}`);
  for (const [k, v] of Object.entries(answers)) {
    if (!(v >= 0 && v <= 3)) throw new Error(`answer ${k} must be 0–3`);
  }
  const total = QUESTION_IDS.reduce((sum, id) => sum + (answers[id] as number), 0); // 0 to 15
  let index = Math.min(3, Math.floor((total * 4) / 16));
  if (answers["horizon"] === 0 || answers["drop"] === 0) index = 0;
  else if (answers["income"] === 0 && index > 1) index = 1;
  return LEVELS[index] as Level;
}
