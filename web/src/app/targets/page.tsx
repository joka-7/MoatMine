"use client";

import { useState } from "react";
import SymbolSearch from "@/components/SymbolSearch";
import { Check, Evaluation, Intent, Target } from "@/lib/api";
import { evaluateTargets, listTargets, removeTarget, saveTarget, type TargetInput } from "@/lib/data/targets";
import { money, share } from "@/lib/format";
import { useI18n, type I18n, type MessageKey } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { useLoader } from "@/lib/useLoader";

/*
 * PAPI = Profit · Amount · Period · Intent
 * MAMI = MAx / MIn bounds on each of them.
 */
const DIMS = [
  { key: "profit", label: "risk.dim.profit", unit: "risk.unit.profit", fields: ["profit_target", "profit_min", "profit_max"], fmt: (v: number) => share(v) },
  { key: "amount", label: "risk.dim.amount", unit: "risk.unit.amount", fields: ["amount_target", "amount_min", "amount_max"], fmt: (v: number) => money(v) },
  { key: "period", label: "risk.dim.period", unit: "risk.unit.period", fields: ["period_target_days", "period_min_days", "period_max_days"], fmt: (v: number, t: I18n["t"]) => t("risk.targets.days", { n: v }) },
  { key: "intent", label: "risk.dim.intent", unit: "risk.unit.intent", fields: ["risk_target", "risk_min", "risk_max"], fmt: (v: number) => share(v) },
] as const;
const INTENTS: Intent[] = ["growth", "income", "speculation", "hedge", "retirement", "custom"];
const INTENT_LABEL: Record<Intent, MessageKey> = {
  growth: "risk.intent.growth", income: "risk.intent.income", speculation: "risk.intent.speculation",
  hedge: "risk.intent.hedge", retirement: "risk.intent.retirement", custom: "risk.intent.custom",
};
const STATUS_LABEL: Record<Check["status"], MessageKey> = {
  ok: "risk.status.ok", reached: "risk.status.reached", below_min: "risk.status.below_min",
  above_max: "risk.status.above_max", unset: "risk.status.unset", no_data: "risk.noData",
};
const intentLabel = (t: I18n["t"], intent: string) => (intent in INTENT_LABEL ? t(INTENT_LABEL[intent as Intent]) : intent);

type Form = Record<string, string>;
const blank = (): Form => ({ name: "", symbol: "", intent: "growth", intent_note: "", ...Object.fromEntries(DIMS.flatMap((d) => d.fields.map((f) => [f, ""]))) });

function toPayload(f: Form): TargetInput {
  const num = (k: string) => (f[k] === "" || f[k] === undefined ? null : +f[k]);
  return {
    name: f.name, symbol: f.symbol || null, intent: f.intent as Intent, intent_note: f.intent_note ?? "",
    profit_target: num("profit_target"), profit_min: num("profit_min"), profit_max: num("profit_max"),
    amount_target: num("amount_target"), amount_min: num("amount_min"), amount_max: num("amount_max"),
    period_target_days: num("period_target_days"), period_min_days: num("period_min_days"), period_max_days: num("period_max_days"),
    risk_target: num("risk_target"), risk_min: num("risk_min"), risk_max: num("risk_max"),
  };
}

function fromTarget(t: Target): Form {
  const f = blank();
  Object.entries(t).forEach(([k, v]) => k in f && (f[k] = v == null ? "" : String(v)));
  return f;
}

export default function TargetsPage() {
  const { on: local, ready } = useLocalMode();
  const { data: targets, reload: reloadT } = useLoader<Target[]>(ready ? () => listTargets(local) : null, `targets:${local}`);
  const { data: evals, reload: reloadE } = useLoader<Evaluation[]>(ready ? () => evaluateTargets(local) : null, `evaluations:${local}`);
  const [form, setForm] = useState<Form>(blank());
  const [editing, setEditing] = useState<number | string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { t } = useI18n();

  const reload = () => Promise.all([reloadT(), reloadE()]);
  const save = async () => {
    try {
      setErr(null);
      await saveTarget(toPayload(form), editing);
      setForm(blank());
      setEditing(null);
      reload();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t("risk.targets.title")}</h1>
          <div className="sub">{t("risk.targets.sub")}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>{t(editing ? "risk.targets.edit" : "risk.targets.new")}</h2>
        {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid" style={{ gap: 12 }}>
          <div className="row">
            <label className="f">{t("risk.targets.name")}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("risk.targets.namePlaceholder")} /></label>
            <label className="f">{t("risk.targets.scope")} {form.symbol ? <b className="sym" style={{ color: "var(--accent)" }}>{form.symbol} <a onClick={() => setForm({ ...form, symbol: "" })} style={{ cursor: "pointer" }}>×</a></b> : <b>{t("risk.targets.wholePortfolio")}</b>}
              <SymbolSearch placeholder={t("risk.targets.scopePlaceholder")} onPick={(s) => setForm({ ...form, symbol: s })} />
            </label>
          </div>
          <div className="scroll-x">
            <table>
              <thead><tr><th>PAPI</th><th>{t("risk.targets.measuredAs")}</th><th className="n">{t("risk.targets.target")}</th><th className="n">{t("risk.targets.min")}</th><th className="n">{t("risk.targets.max")}</th></tr></thead>
              <tbody>
                {DIMS.map((d) => (
                  <tr key={d.key}>
                    <td><b>{t(d.label)}</b>{d.key === "intent" && (
                      <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} style={{ marginTop: 6 }}>
                        {INTENTS.map((i) => <option key={i} value={i}>{t(INTENT_LABEL[i])}</option>)}
                      </select>
                    )}</td>
                    <td className="sub">{t(d.unit)}</td>
                    {d.fields.map((k) => (
                      <td key={k} style={{ width: 150 }}>
                        <input type="number" step="any" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ textAlign: "end" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="f">{t("risk.targets.intentNote")}<input value={form.intent_note} onChange={(e) => setForm({ ...form, intent_note: e.target.value })} placeholder={t("risk.targets.intentNotePlaceholder")} /></label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm(blank()); }}>{t("common.cancel")}</button>}
            <button className="btn primary">{t(editing ? "risk.targets.saveChanges" : "risk.targets.add")}</button>
          </div>
        </form>
      </div>

      <div className="grid g2">
        {evals?.map((e) => {
          const target = targets?.find((x) => x.id === e.target_id);
          return (
            <div key={e.target_id} className="card">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b>{e.name}</b> <span className="sub">{e.symbol ?? t("common.portfolio")} · {intentLabel(t, e.checks.intent.intent)}</span>
                  {e.checks.intent.note && <div className="sub" style={{ fontSize: 12 }}>{e.checks.intent.note}</div>}
                </div>
                <div className="seg" style={{ flex: "0 1 auto" }}>
                  <button className="btn sm" onClick={() => { if (target) { setForm(fromTarget(target)); setEditing(target.id); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>{t("risk.targets.editButton")}</button>
                  <button className="btn sm" onClick={async () => { await removeTarget(e.target_id); reload(); }}>{t("common.delete")}</button>
                </div>
              </div>
              {DIMS.map((d) => <RangeRow key={d.key} label={t(d.label)} c={e.checks[d.key]} fmt={(v) => d.fmt(v, t)} />)}
            </div>
          );
        })}
      </div>
      {evals && !evals.length && <div className="empty">{t("risk.targets.none")}</div>}
    </>
  );
}

function RangeRow({ label, c, fmt }: { label: string; c: Check; fmt: (v: number) => string }) {
  const { t } = useI18n();
  if (c.status === "unset") return null;
  const pts = [c.value, c.target, c.min, c.max].filter((v): v is number => v != null);
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo || 1;
  const pos = (v: number) => `${((v - lo) / span) * 92 + 4}%`;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{label}</span>
        <span><span className="num">{c.value == null ? "—" : fmt(c.value)}</span> <span className={`chip ${c.status}`}>{c.status in STATUS_LABEL ? t(STATUS_LABEL[c.status]) : c.status}</span></span>
      </div>
      <div style={{ position: "relative", height: 18, marginTop: 6 }}>
        <div style={{ position: "absolute", top: 8, insetInlineStart: "4%", insetInlineEnd: "4%", height: 2, background: "var(--line)" }} />
        {c.min != null && c.max != null && (
          <div style={{ position: "absolute", top: 7, insetInlineStart: pos(c.min), width: `calc(${pos(c.max)} - ${pos(c.min)})`, height: 4, background: "color-mix(in srgb, var(--up) 35%, transparent)", borderRadius: 2 }} />
        )}
        {c.min != null && <Tick at={pos(c.min)} color="var(--muted)" title={t("risk.targets.rangeMin", { v: fmt(c.min) })} />}
        {c.max != null && <Tick at={pos(c.max)} color="var(--muted)" title={t("risk.targets.rangeMax", { v: fmt(c.max) })} />}
        {c.target != null && <Tick at={pos(c.target)} color="var(--accent)" title={t("risk.targets.rangeTarget", { v: fmt(c.target) })} tall />}
        {c.value != null && (
          <div title={t("risk.targets.rangeNow", { v: fmt(c.value) })} style={{ position: "absolute", insetInlineStart: pos(c.value), top: 3, width: 12, height: 12, marginInlineStart: -6, borderRadius: 99, background: c.status === "below_min" || c.status === "above_max" ? "var(--down)" : "var(--text)" }} />
        )}
      </div>
      <div className="sub" style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span>{t("risk.targets.rangeMin", { v: c.min == null ? "—" : fmt(c.min) })}</span>
        <span>{c.progress_pct == null
          ? t("risk.targets.rangeTarget", { v: c.target == null ? "—" : fmt(c.target) })
          : t("risk.targets.rangeTargetProgress", { v: c.target == null ? "—" : fmt(c.target), progress: share(c.progress_pct) })}</span>
        <span>{t("risk.targets.rangeMax", { v: c.max == null ? "—" : fmt(c.max) })}</span>
      </div>
    </div>
  );
}

function Tick({ at, color, title, tall }: { at: string; color: string; title: string; tall?: boolean }) {
  return <div title={title} style={{ position: "absolute", insetInlineStart: at, top: tall ? 0 : 4, width: 2, height: tall ? 18 : 10, marginInlineStart: -1, background: color }} />;
}
