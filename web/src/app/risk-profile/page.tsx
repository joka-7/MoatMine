"use client";

import { useEffect, useState } from "react";
import { api, Question, RiskLevel, RiskProfile, RiskRules } from "@/lib/api";
import { useApi } from "@/lib/useApi";

const RULE_FIELDS: { key: keyof RiskRules; label: string; hint: string; step?: string }[] = [
  { key: "max_position_pct", label: "Max in one stock %", hint: "of your whole portfolio" },
  { key: "max_sector_pct", label: "Max in one sector %", hint: "diversification" },
  { key: "min_safety_score", label: "Minimum safety score", hint: "0–100, below this a buy is blocked" },
  { key: "max_volatility_pct", label: "Max volatility %/yr", hint: "per stock; above it a buy needs a reason" },
  { key: "max_drawdown_pct", label: "Portfolio loss limit %", hint: "negative; stress tests and alerts use it" },
  { key: "min_market_cap_m", label: "Minimum company size $M", hint: "market cap", step: "100" },
  { key: "cooling_off_hours", label: "Cooling-off hours", hint: "wait before a risky buy can run", step: "1" },
];

const LEVEL_TEXT: Record<RiskLevel, string> = {
  conservative: "Protect capital first. Small positions, only strong companies, long waits before risky buys.",
  moderate: "Mostly steady companies with room for some growth.",
  balanced: "A mix of stability and growth, with wider limits.",
  growth: "Accepts bigger swings for growth. Still blocks distressed and penny stocks by default.",
};

export default function RiskProfilePage() {
  const { data: qs } = useApi<{ questions: Question[]; levels: RiskLevel[] }>("/safety/questions");
  const { data: current, setData } = useApi<RiskProfile>("/safety/profile");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [rules, setRules] = useState<Partial<RiskRules>>({});
  const [paper, setPaper] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

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
      setData(await api<RiskProfile>("/safety/profile", { method: "PUT", json: { answers, paper_mode: paper } }));
      setMsg("Profile saved from your answers.");
    } catch (e) { setMsg((e as Error).message); }
  };
  const saveRules = async () => {
    if (!current) return;
    try {
      setData(await api<RiskProfile>("/safety/profile", {
        method: "PUT",
        json: { level: current.level, answers: undefined, paper_mode: paper, ...rules, allow_penny_stocks: rules.allow_penny_stocks ?? false },
      }));
      setMsg("Rules saved.");
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Risk profile</h1>
          <div className="sub">Your own rules. Every safety check, buy plan, alert and the AI agent follow them.</div>
        </div>
      </div>
      {msg && <div className="sub" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="grid g2">
        <div className="card">
          <h2>1 · Questionnaire</h2>
          {qs?.questions.map((q, i) => (
            <fieldset key={q.id} style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
              <legend style={{ marginBottom: 6 }}>{i + 1}. {q.text}</legend>
              <div className="seg">
                {q.options.map((o, idx) => (
                  <button key={o} type="button" className={`btn sm ${answers[q.id] === idx ? "on" : ""}`}
                    onClick={() => setAnswers({ ...answers, [q.id]: idx })}>{o}</button>
                ))}
              </div>
            </fieldset>
          ))}
          <button className="btn primary" disabled={!allAnswered} onClick={saveFromAnswers}>Set my profile</button>
        </div>

        <div className="card">
          <h2>2 · Your rules</h2>
          {current && (
            <div style={{ marginBottom: 12 }}>
              <span className="chip ok" style={{ fontSize: 12 }}>{current.level}</span>{" "}
              {!current.saved && <span className="chip">default, not saved yet</span>}
              <div className="sub" style={{ marginTop: 6 }}>{LEVEL_TEXT[current.level]}</div>
            </div>
          )}
          <div className="grid" style={{ gap: 8 }}>
            {RULE_FIELDS.map((f) => (
              <label key={f.key} className="f">
                <span>{f.label} <span style={{ opacity: 0.6 }}>· {f.hint}</span></span>
                <input type="number" step={f.step ?? "any"} value={String(rules[f.key] ?? "")}
                  onChange={(e) => setRules({ ...rules, [f.key]: e.target.value === "" ? undefined : +e.target.value })} />
              </label>
            ))}
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={!!rules.allow_penny_stocks}
                onChange={(e) => setRules({ ...rules, allow_penny_stocks: e.target.checked })} /> Allow penny stocks (under $5)
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={paper} onChange={(e) => setPaper(e.target.checked)} />
              Paper-trading mode: practise with a paper account before using real money
            </label>
            <button className="btn primary" onClick={saveRules} disabled={!current}>Save rules</button>
          </div>
        </div>
      </div>
    </>
  );
}
