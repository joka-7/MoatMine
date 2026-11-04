"use client";

import { useEffect, useState } from "react";
import { Question, RiskLevel, RiskProfile, RiskRules } from "@/lib/api";
import { getProfile, saveProfile } from "@/lib/data/riskProfile";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { useApi } from "@/lib/useApi";
import { useLoader } from "@/lib/useLoader";

const RULE_FIELDS: { key: keyof RiskRules; label: MessageKey; hint: MessageKey; step?: string }[] = [
  { key: "max_position_pct", label: "risk.rule.maxPosition", hint: "risk.rule.maxPositionHint" },
  { key: "max_sector_pct", label: "risk.rule.maxSector", hint: "risk.rule.maxSectorHint" },
  { key: "min_safety_score", label: "risk.rule.minSafety", hint: "risk.rule.minSafetyHint" },
  { key: "max_volatility_pct", label: "risk.rule.maxVolatility", hint: "risk.rule.maxVolatilityHint" },
  { key: "max_drawdown_pct", label: "risk.rule.lossLimit", hint: "risk.rule.lossLimitHint" },
  { key: "min_market_cap_m", label: "risk.rule.minMarketCap", hint: "risk.rule.minMarketCapHint", step: "100" },
  { key: "cooling_off_hours", label: "risk.rule.coolingOff", hint: "risk.rule.coolingOffHint", step: "1" },
];

const LEVEL: Record<RiskLevel, { name: MessageKey; text: MessageKey }> = {
  conservative: { name: "risk.level.conservative", text: "risk.levelText.conservative" },
  moderate: { name: "risk.level.moderate", text: "risk.levelText.moderate" },
  balanced: { name: "risk.level.balanced", text: "risk.levelText.balanced" },
  growth: { name: "risk.level.growth", text: "risk.levelText.growth" },
};

// The questionnaire comes from the API in English; known questions show local text, others the server's.
const QUESTION_TEXT: Readonly<Record<string, { text: MessageKey; options: readonly MessageKey[] }>> = {
  horizon: { text: "risk.q.horizon", options: ["risk.q.horizon.0", "risk.q.horizon.1", "risk.q.horizon.2", "risk.q.horizon.3"] },
  drop: { text: "risk.q.drop", options: ["risk.q.drop.0", "risk.q.drop.1", "risk.q.drop.2", "risk.q.drop.3"] },
  goal: { text: "risk.q.goal", options: ["risk.q.goal.0", "risk.q.goal.1", "risk.q.goal.2", "risk.q.goal.3"] },
  experience: { text: "risk.q.experience", options: ["risk.q.experience.0", "risk.q.experience.1", "risk.q.experience.2", "risk.q.experience.3"] },
  income: { text: "risk.q.income", options: ["risk.q.income.0", "risk.q.income.1", "risk.q.income.2", "risk.q.income.3"] },
};

export default function RiskProfilePage() {
  const { data: qs } = useApi<{ questions: Question[]; levels: RiskLevel[] }>("/safety/questions");
  const { on: local, ready } = useLocalMode();
  const { data: current, setData } = useLoader<RiskProfile>(ready ? () => getProfile(local) : null, `profile:${local}`);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [rules, setRules] = useState<Partial<RiskRules>>({});
  const [paper, setPaper] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!current) return;
    setAnswers(current.answers);
    setPaper(current.paper_mode);
    setRules(Object.fromEntries(RULE_FIELDS.map((f) => [f.key, current[f.key]])) as Partial<RiskRules>);
  }, [current]);

  const allAnswered = qs?.questions.every((q) => answers[q.id] !== undefined) ?? false;

  const saveFromAnswers = async () => {
    try {
      // a fresh questionnaire result resets the rules to that level's defaults
      setData(await saveProfile({ answers, paper_mode: paper }));
      setMsg(t("risk.profile.savedFromAnswers"));
    } catch (e) { setMsg((e as Error).message); }
  };
  const saveRules = async () => {
    if (!current) return;
    try {
      setData(await saveProfile({ level: current.level, paper_mode: paper, ...rules, allow_penny_stocks: rules.allow_penny_stocks ?? false }));
      setMsg(t("risk.profile.rulesSaved"));
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t("risk.profile.title")}</h1>
          <div className="sub">{t("risk.profile.sub")}</div>
        </div>
      </div>
      {msg && <div className="sub" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="grid g2">
        <div className="card">
          <h2>{t("risk.profile.questionnaire")}</h2>
          {qs?.questions.map((q, i) => {
            const local = QUESTION_TEXT[q.id];
            const labels = local && local.options.length === q.options.length ? local.options.map((k) => t(k)) : q.options;
            return (
              <fieldset key={q.id} style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
                <legend style={{ marginBottom: 6 }}>{i + 1}. {local ? t(local.text) : q.text}</legend>
                <div className="seg">
                  {q.options.map((o, idx) => (
                    <button key={o} type="button" className={`btn sm ${answers[q.id] === idx ? "on" : ""}`}
                      onClick={() => setAnswers({ ...answers, [q.id]: idx })}>{labels[idx] ?? o}</button>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <button className="btn primary" disabled={!allAnswered} onClick={saveFromAnswers}>{t("risk.profile.setProfile")}</button>
        </div>

        <div className="card">
          <h2>{t("risk.profile.yourRules")}</h2>
          {current && (
            <div style={{ marginBottom: 12 }}>
              <span className="chip ok" style={{ fontSize: 12 }}>{t(LEVEL[current.level].name)}</span>{" "}
              {!current.saved && <span className="chip">{t("risk.profile.notSaved")}</span>}
              <div className="sub" style={{ marginTop: 6 }}>{t(LEVEL[current.level].text)}</div>
            </div>
          )}
          <div className="grid" style={{ gap: 8 }}>
            {RULE_FIELDS.map((f) => (
              <label key={f.key} className="f">
                <span>{t(f.label)} <span style={{ opacity: 0.6 }}>· {t(f.hint)}</span></span>
                <input type="number" step={f.step ?? "any"} value={String(rules[f.key] ?? "")}
                  onChange={(e) => setRules({ ...rules, [f.key]: e.target.value === "" ? undefined : +e.target.value })} />
              </label>
            ))}
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={!!rules.allow_penny_stocks}
                onChange={(e) => setRules({ ...rules, allow_penny_stocks: e.target.checked })} /> {t("risk.profile.allowPenny")}
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={paper} onChange={(e) => setPaper(e.target.checked)} />
              {t("risk.profile.paperMode")}
            </label>
            <button className="btn primary" onClick={saveRules} disabled={!current}>{t("risk.profile.saveRules")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
