"use client";

import { useState } from "react";
import SymbolSearch from "@/components/SymbolSearch";
import { api, Check, Evaluation, Intent, Target } from "@/lib/api";
import { money, num } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/*
 * PAPI = Profit · Amount · Period · Intent
 * MAMI = MAx / MIn bounds on each of them.
 */
const DIMS = [
  { key: "profit", label: "Profit", unit: "% return", fields: ["profit_target", "profit_min", "profit_max"], fmt: (v: number) => `${num(v)}%` },
  { key: "amount", label: "Amount", unit: "market value", fields: ["amount_target", "amount_min", "amount_max"], fmt: (v: number) => money(v) },
  { key: "period", label: "Period", unit: "days held", fields: ["period_target_days", "period_min_days", "period_max_days"], fmt: (v: number) => `${v}d` },
  { key: "intent", label: "Intent", unit: "risk · ann. volatility %", fields: ["risk_target", "risk_min", "risk_max"], fmt: (v: number) => `${num(v)}%` },
] as const;
const INTENTS: Intent[] = ["growth", "income", "speculation", "hedge", "retirement", "custom"];

type Form = Record<string, string>;
const blank = (): Form => ({ name: "", symbol: "", intent: "growth", intent_note: "", ...Object.fromEntries(DIMS.flatMap((d) => d.fields.map((f) => [f, ""]))) });

function toPayload(f: Form) {
  const out: Record<string, unknown> = { name: f.name, symbol: f.symbol || null, intent: f.intent, intent_note: f.intent_note };
  DIMS.forEach((d) => d.fields.forEach((k) => (out[k] = f[k] === "" ? null : +f[k])));
  return out;
}

function fromTarget(t: Target): Form {
  const f = blank();
  Object.entries(t).forEach(([k, v]) => k in f && (f[k] = v == null ? "" : String(v)));
  return f;
}

export default function TargetsPage() {
  const { data: targets, reload: reloadT } = useApi<Target[]>("/targets");
  const { data: evals, reload: reloadE } = useApi<Evaluation[]>("/targets/evaluate");
  const [form, setForm] = useState<Form>(blank());
  const [editing, setEditing] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => Promise.all([reloadT(), reloadE()]);
  const save = async () => {
    try {
      setErr(null);
      await api(editing ? `/targets/${editing}` : "/targets", { method: editing ? "PUT" : "POST", json: toPayload(form) });
      setForm(blank());
      setEditing(null);
      reload();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Targets</h1>
          <div className="sub">PAPI — Profit, Amount, Period, Intent — each with MAMI min/max bounds. Breaches raise alerts.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>{editing ? "Edit target" : "New target"}</h2>
        {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid" style={{ gap: 12 }}>
          <div className="row">
            <label className="f">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Retire by 2040" /></label>
            <label className="f">Scope {form.symbol ? <b className="sym" style={{ color: "var(--accent)" }}>{form.symbol} <a onClick={() => setForm({ ...form, symbol: "" })} style={{ cursor: "pointer" }}>×</a></b> : <b>whole portfolio</b>}
              <SymbolSearch placeholder="Leave empty for portfolio" onPick={(s) => setForm({ ...form, symbol: s })} />
            </label>
          </div>
          <div className="scroll-x">
            <table>
              <thead><tr><th>PAPI</th><th>Measured as</th><th className="n">Target</th><th className="n">Min</th><th className="n">Max</th></tr></thead>
              <tbody>
                {DIMS.map((d) => (
                  <tr key={d.key}>
                    <td><b>{d.label}</b>{d.key === "intent" && (
                      <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} style={{ marginTop: 6 }}>
                        {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                    )}</td>
                    <td className="sub">{d.unit}</td>
                    {d.fields.map((k) => (
                      <td key={k} style={{ width: 150 }}>
                        <input type="number" step="any" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ textAlign: "right" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="f">Intent note<input value={form.intent_note} onChange={(e) => setForm({ ...form, intent_note: e.target.value })} placeholder="why this position exists" /></label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm(blank()); }}>Cancel</button>}
            <button className="btn primary">{editing ? "Save changes" : "Add target"}</button>
          </div>
        </form>
      </div>

      <div className="grid g2">
        {evals?.map((e) => {
          const t = targets?.find((x) => x.id === e.target_id);
          return (
            <div key={e.target_id} className="card">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b>{e.name}</b> <span className="sub">{e.symbol ?? "portfolio"} · {e.checks.intent.intent}</span>
                  {e.checks.intent.note && <div className="sub" style={{ fontSize: 12 }}>{e.checks.intent.note}</div>}
                </div>
                <div className="seg" style={{ flex: "0 1 auto" }}>
                  <button className="btn sm" onClick={() => { if (t) { setForm(fromTarget(t)); setEditing(t.id); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>Edit</button>
                  <button className="btn sm" onClick={async () => { await api(`/targets/${e.target_id}`, { method: "DELETE" }); reload(); }}>Delete</button>
                </div>
              </div>
              {DIMS.map((d) => <RangeRow key={d.key} label={d.label} c={e.checks[d.key]} fmt={d.fmt} />)}
            </div>
          );
        })}
      </div>
      {evals && !evals.length && <div className="empty">No targets yet.</div>}
    </>
  );
}

function RangeRow({ label, c, fmt }: { label: string; c: Check; fmt: (v: number) => string }) {
  if (c.status === "unset") return null;
  const pts = [c.value, c.target, c.min, c.max].filter((v): v is number => v != null);
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo || 1;
  const pos = (v: number) => `${((v - lo) / span) * 92 + 4}%`;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{label}</span>
        <span><span className="num">{c.value == null ? "—" : fmt(c.value)}</span> <span className={`chip ${c.status}`}>{c.status.replace("_", " ")}</span></span>
      </div>
      <div style={{ position: "relative", height: 18, marginTop: 6 }}>
        <div style={{ position: "absolute", top: 8, left: "4%", right: "4%", height: 2, background: "var(--line)" }} />
        {c.min != null && c.max != null && (
          <div style={{ position: "absolute", top: 7, left: pos(c.min), width: `calc(${pos(c.max)} - ${pos(c.min)})`, height: 4, background: "color-mix(in srgb, var(--up) 35%, transparent)", borderRadius: 2 }} />
        )}
        {c.min != null && <Tick at={pos(c.min)} color="var(--muted)" title={`min ${fmt(c.min)}`} />}
        {c.max != null && <Tick at={pos(c.max)} color="var(--muted)" title={`max ${fmt(c.max)}`} />}
        {c.target != null && <Tick at={pos(c.target)} color="var(--accent)" title={`target ${fmt(c.target)}`} tall />}
        {c.value != null && (
          <div title={`now ${fmt(c.value)}`} style={{ position: "absolute", left: pos(c.value), top: 3, width: 12, height: 12, marginLeft: -6, borderRadius: 99, background: c.status === "below_min" || c.status === "above_max" ? "var(--down)" : "var(--text)" }} />
        )}
      </div>
      <div className="sub" style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span>min {c.min == null ? "—" : fmt(c.min)}</span>
        <span>target {c.target == null ? "—" : fmt(c.target)}{c.progress_pct != null ? ` · ${c.progress_pct}%` : ""}</span>
        <span>max {c.max == null ? "—" : fmt(c.max)}</span>
      </div>
    </div>
  );
}

function Tick({ at, color, title, tall }: { at: string; color: string; title: string; tall?: boolean }) {
  return <div title={title} style={{ position: "absolute", left: at, top: tall ? 0 : 4, width: 2, height: tall ? 18 : 10, marginLeft: -1, background: color }} />;
}
