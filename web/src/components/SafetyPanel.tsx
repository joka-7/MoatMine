"use client";

import Link from "next/link";
import { useState } from "react";
import { Account, api, ApiError, BuyPlan, CheckResult, RiskProfile, SafetyAnalysis, SafetyReport } from "@/lib/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import MoatCard from "./MoatCard";
import { CheckView, GradeBadge, ScoreRing } from "./SafetyBits";
import { isSampleData } from "@/lib/dataSource";

const PLAN_STATUS: Readonly<Record<string, MessageKey>> = {
  blocked: "risk.planStatus.blocked", cooling_off: "risk.planStatus.cooling_off", ready: "risk.planStatus.ready",
  executed: "risk.planStatus.executed", cancelled: "risk.planStatus.cancelled",
};

function fmtFact(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  return String(v);
}

export default function SafetyPanel({ symbol }: { symbol: string }) {
  const { data: r, error } = useApi<SafetyReport>(`/stocks/${symbol}/safety`);
  const { data: profile } = useApi<RiskProfile>("/safety/profile");
  const [ai, setAi] = useState<SafetyAnalysis | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const { t } = useI18n();

  const analyze = async () => {
    setAiBusy(true); setAiErr(null);
    try { setAi(await api<SafetyAnalysis>(`/stocks/${symbol}/safety/analyze`, { method: "POST" })); }
    catch (e) { setAiErr((e as Error).message); }
    finally { setAiBusy(false); }
  };

  const meetsMin = r?.score != null && profile ? r.score >= profile.min_safety_score : null;

  return (
    <div className="grid" style={{ gap: 16 }}>
      {error && <div className="err">{error}</div>}
      <div className="grid g3">
        <div className="card" style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <ScoreRing score={r?.score ?? null} grade={r?.grade ?? null} />
          <div>
            <h2 style={{ marginBottom: 6 }}>{t("risk.finalScore")}</h2>
            <div style={{ fontWeight: 600 }}>{r?.analysis.verdict}</div>
            {profile && meetsMin != null && (
              <div className={meetsMin ? "up" : "down"} style={{ fontSize: 13, marginTop: 6 }}>
                {t(meetsMin ? "risk.meetsMin" : "risk.belowMin", { min: profile.min_safety_score })}
                {!profile.saved && <> · <Link href="/risk-profile" style={{ textDecoration: "underline" }}>{t("risk.setYourProfile")}</Link></>}
              </div>
            )}
            {r && <div className="sub" style={{ fontSize: 11, marginTop: 4 }}>{t(isSampleData(r.data_source) ? "risk.basedOnSample" : "risk.basedOn", { pct: `${r.coverage_pct}%` })}</div>}
          </div>
        </div>
        <div className="card span2">
          <h2>{t("risk.gradesByArea")}</h2>
          <div className="grid g3" style={{ gap: 10 }}>
            {r?.areas.map((a) => (
              <div key={a.key} style={{ display: "flex", gap: 10, alignItems: "center", padding: 8, border: "1px solid var(--line)", borderRadius: 8 }}>
                <GradeBadge grade={a.grade} size={34} />
                <div>
                  <div>{a.name}</div>
                  <div className="sub" style={{ fontSize: 12 }}>{a.score == null ? t("risk.areaNoData", { weight: `${a.weight}%` }) : t("risk.areaScore", { score: a.score, weight: `${a.weight}%` })}</div>
                </div>
              </div>
            ))}
          </div>
          {r?.analysis.summary && <p style={{ marginBottom: 0 }}>{r.analysis.summary}</p>}
          {!!r?.flags.length && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {r.flags.map((f) => <span key={f.code} className={`chip ${f.severity === "high" ? "below_min" : ""}`}>⚠ {f.message}</span>)}
            </div>
          )}
        </div>
      </div>

      {r && <MoatCard moat={r.moat} area={r.areas.find((a) => a.key === "moat")} />}

      <div className="grid g3">
        <div className="card span2">
          <h2>{t("risk.aiAnalyzer")}</h2>
          {!ai && <div className="sub">{t("risk.aiIntro", { symbol })}</div>}
          {ai && (
            <>
              <p style={{ marginTop: 0 }}>{ai.overview}</p>
              {ai.areas.map((a) => (
                <div key={a.name} style={{ padding: "4px 0" }}><b>{a.name}:</b> <span className="sub">{a.comment}</span></div>
              ))}
              {ai.fit && <p><b>{t("risk.aiFit")}</b> {ai.fit}</p>}
              {ai.improve && <p className="sub" style={{ marginBottom: 0 }}><b>{t("risk.aiImprove")}</b> {ai.improve}</p>}
              <div className="sub" style={{ fontSize: 11, marginTop: 8 }}>{t("risk.aiFooter", { model: ai.model })}</div>
            </>
          )}
          {aiErr && <div className="err" style={{ marginTop: 8 }}>{aiErr}</div>}
          <button className="btn primary" style={{ marginTop: 10 }} onClick={analyze} disabled={aiBusy}>
            {t(aiBusy ? "risk.analyzing" : ai ? "risk.reanalyze" : "risk.analyze")}
          </button>
        </div>
        <BuyCheck symbol={symbol} />
      </div>

      <div className="card">
        <h2>{t("risk.scoreBuilt")}</h2>
        <div className="scroll-x">
          <table>
            <thead><tr><th>{t("risk.component")}</th><th className="n">{t("common.value")}</th><th className="n">{t("risk.points")}</th><th>{t("risk.scale")}</th></tr></thead>
            <tbody>
              {r?.components.map((c) => (
                <tr key={c.name} style={{ opacity: c.points == null ? 0.5 : 1 }}>
                  <td>{c.name}</td>
                  <td className="n"><bdi>{fmtFact(c.value)}</bdi></td>
                  <td className="n">{c.points == null ? t("risk.noData") : `${c.points}/${c.max}`}</td>
                  <td className="sub" style={{ fontSize: 12 }}>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function BuyCheck({ symbol }: { symbol: string }) {
  const { data: accounts } = useApi<Account[]>("/accounts");
  const [account, setAccount] = useState("");
  const [qty, setQty] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<BuyPlan | null>(null);
  const { t } = useI18n();

  const run = async () => {
    setMsg(null); setPlan(null);
    // size the buy against the book it would land in: paper accounts never count toward real money
    const paper = accounts?.find((a) => a.id === +account)?.broker === "paper";
    try { setCheck(await api<CheckResult>("/safety/check", { method: "POST", json: { symbol, quantity: +qty, mode: paper ? "paper" : "real" } })); }
    catch (e) { setMsg((e as Error).message); }
  };
  const makePlan = async () => {
    setMsg(null);
    try {
      const out = await api<BuyPlan>("/plans", { method: "POST", json: { account_id: +account, symbol, quantity: +qty, note } });
      setPlan(out);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : (e as Error).message);
    }
  };

  return (
    <div className="card">
      <h2>{t("risk.checkBuy")}</h2>
      <div className="row">
        <label className="f">{t("risk.account")}
          <select value={account} onChange={(e) => { setAccount(e.target.value); setCheck(null); }}>
            <option value="">—</option>
            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.broker === "paper" ? t("risk.paperAccount", { name: a.name }) : a.name}</option>)}
          </select>
        </label>
        <label className="f">{t("risk.shares")}<input type="number" min="0" step="any" value={qty} onChange={(e) => { setQty(e.target.value); setCheck(null); }} /></label>
      </div>
      <button className="btn" style={{ marginTop: 8 }} onClick={run} disabled={!qty}>{t("risk.runCheck")}</button>
      {check && (
        <div style={{ marginTop: 12 }}>
          <CheckView check={check} />
          {check.verdict !== "block" && (
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              {check.requires_note && (
                <textarea rows={3} placeholder={t("risk.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
              )}
              <button className="btn primary" disabled={!account || (check.requires_note && note.trim().length < 20)} onClick={makePlan}>{t("risk.createPlan")}</button>
            </div>
          )}
        </div>
      )}
      {plan && <PlanCreated plan={plan} />}
      {msg && <div className="err" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function PlanCreated({ plan }: { plan: BuyPlan }) {
  const { t, lang } = useI18n();
  const status = PLAN_STATUS[plan.status];
  // the status is set in bold inside a translated sentence, so split the sentence where it goes
  const mark = "\u0000";
  const sentence = plan.status === "cooling_off"
    ? t("risk.planIsUntil", { id: plan.id, status: mark, when: new Date(plan.available_at).toLocaleString(lang === "he" ? "he-IL" : undefined) })
    : t("risk.planIs", { id: plan.id, status: mark });
  const [before, after] = sentence.split(mark);
  return (
    <div className="sub" style={{ marginTop: 10 }}>
      {before}<b>{status ? t(status) : plan.status}</b>{after} <Link href="/plans" style={{ textDecoration: "underline" }}>{t("risk.plansLink")}</Link>
    </div>
  );
}
