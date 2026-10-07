"use client";

import Link from "next/link";
import { useState } from "react";
import { Account, api, ApiError, BuyPlan, CheckResult, RiskProfile, SafetyAnalysis, SafetyReport } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import MoatCard from "./MoatCard";
import { CheckView, GradeBadge, ScoreRing } from "./SafetyBits";

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
            <h2 style={{ marginBottom: 6 }}>Final safety score</h2>
            <div style={{ fontWeight: 600 }}>{r?.analysis.verdict}</div>
            {profile && meetsMin != null && (
              <div className={meetsMin ? "up" : "down"} style={{ fontSize: 13, marginTop: 6 }}>
                {meetsMin ? "Meets" : "Below"} your minimum of {profile.min_safety_score}
                {!profile.saved && <> · <Link href="/risk-profile" style={{ textDecoration: "underline" }}>set your profile</Link></>}
              </div>
            )}
            {r && <div className="sub" style={{ fontSize: 11, marginTop: 4 }}>Based on {r.coverage_pct}% of the model{r.data_source.startsWith("mock") ? " · sample data" : ""}</div>}
          </div>
        </div>
        <div className="card span2">
          <h2>Grades by area</h2>
          <div className="grid g3" style={{ gap: 10 }}>
            {r?.areas.map((a) => (
              <div key={a.key} style={{ display: "flex", gap: 10, alignItems: "center", padding: 8, border: "1px solid var(--line)", borderRadius: 8 }}>
                <GradeBadge grade={a.grade} size={34} />
                <div>
                  <div>{a.name}</div>
                  <div className="sub" style={{ fontSize: 12 }}>{a.score == null ? "no data" : `${a.score}/100`} · {a.weight}% of score</div>
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
          <h2>AI analyzer</h2>
          {!ai && <div className="sub">Explains each grade in plain language and how {symbol} fits your risk rules.</div>}
          {ai && (
            <>
              <p style={{ marginTop: 0 }}>{ai.overview}</p>
              {ai.areas.map((a) => (
                <div key={a.name} style={{ padding: "4px 0" }}><b>{a.name}:</b> <span className="sub">{a.comment}</span></div>
              ))}
              {ai.fit && <p><b>Fit with your rules:</b> {ai.fit}</p>}
              {ai.improve && <p className="sub" style={{ marginBottom: 0 }}><b>What would improve it:</b> {ai.improve}</p>}
              <div className="sub" style={{ fontSize: 11, marginTop: 8 }}>{ai.model} · risk information, not advice</div>
            </>
          )}
          {aiErr && <div className="err" style={{ marginTop: 8 }}>{aiErr}</div>}
          <button className="btn primary" style={{ marginTop: 10 }} onClick={analyze} disabled={aiBusy}>
            {aiBusy ? "Analyzing…" : ai ? "Re-analyze" : "Analyze with AI"}
          </button>
        </div>
        <BuyCheck symbol={symbol} />
      </div>

      <div className="card">
        <h2>How the score is built</h2>
        <table>
          <thead><tr><th>Component</th><th className="n">Value</th><th className="n">Points</th><th>Scale</th></tr></thead>
          <tbody>
            {r?.components.map((c) => (
              <tr key={c.name} style={{ opacity: c.points == null ? 0.5 : 1 }}>
                <td>{c.name}</td>
                <td className="n">{fmtFact(c.value)}</td>
                <td className="n">{c.points == null ? "no data" : `${c.points}/${c.max}`}</td>
                <td className="sub" style={{ fontSize: 12 }}>{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <h2>Check a buy</h2>
      <div className="row">
        <label className="f">Account
          <select value={account} onChange={(e) => { setAccount(e.target.value); setCheck(null); }}>
            <option value="">—</option>
            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}{a.broker === "paper" ? " (paper)" : ""}</option>)}
          </select>
        </label>
        <label className="f">Shares<input type="number" min="0" step="any" value={qty} onChange={(e) => { setQty(e.target.value); setCheck(null); }} /></label>
      </div>
      <button className="btn" style={{ marginTop: 8 }} onClick={run} disabled={!qty}>Run safety check</button>
      {check && (
        <div style={{ marginTop: 12 }}>
          <CheckView check={check} />
          {check.verdict !== "block" && (
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              {check.requires_note && (
                <textarea rows={3} placeholder="Why do you still want this? (20+ characters, saved to your journal)" value={note} onChange={(e) => setNote(e.target.value)} />
              )}
              <button className="btn primary" disabled={!account || (check.requires_note && note.trim().length < 20)} onClick={makePlan}>Create buy plan</button>
            </div>
          )}
        </div>
      )}
      {plan && (
        <div className="sub" style={{ marginTop: 10 }}>
          Plan #{plan.id} is <b>{plan.status.replace("_", " ")}</b>
          {plan.status === "cooling_off" && ` until ${new Date(plan.available_at).toLocaleString()}`}. <Link href="/plans" style={{ textDecoration: "underline" }}>Buy plans →</Link>
        </div>
      )}
      {msg && <div className="err" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
