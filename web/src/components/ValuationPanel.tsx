"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Valuation, ValModel } from "@/lib/api";
import { money, num, pct, share, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { isSampleData } from "@/lib/dataSource";
import { useI18n, type I18n, type MessageKey } from "@/lib/i18n";

const FIELDS: { key: string; label: MessageKey; hint: MessageKey; def: number | "" }[] = [
  { key: "discount_rate", label: "stock.val.field.discountRate", hint: "stock.val.hint.discountRate", def: 9 },
  { key: "growth_rate", label: "stock.val.field.growthRate", hint: "stock.val.hint.growthRate", def: "" },
  { key: "terminal_growth", label: "stock.val.field.terminalGrowth", hint: "stock.val.hint.terminalGrowth", def: 2.5 },
  { key: "years", label: "stock.val.field.years", hint: "stock.val.hint.years", def: 10 },
  { key: "margin_of_safety", label: "stock.val.field.marginOfSafety", hint: "stock.val.hint.marginOfSafety", def: 25 },
  { key: "bond_yield", label: "stock.val.field.bondYield", hint: "stock.val.hint.bondYield", def: 4.5 },
  { key: "pe_multiple", label: "stock.val.field.peMultiple", hint: "stock.val.hint.peMultiple", def: 18 },
  { key: "ev_ebitda_multiple", label: "stock.val.field.evEbitdaMultiple", hint: "stock.val.hint.evEbitdaMultiple", def: 12 },
  { key: "dividend_growth", label: "stock.val.field.dividendGrowth", hint: "stock.val.hint.dividendGrowth", def: 4 },
];

const INDICATORS: [string, MessageKey, "%"?][] = [
  ["pe", "stock.val.ind.pe"], ["peg", "stock.val.ind.peg"], ["earnings_yield_pct", "stock.val.ind.earningsYield", "%"], ["fcf_yield_pct", "stock.val.ind.fcfYield", "%"],
  ["p_fcf", "stock.val.ind.pFcf"], ["pb", "stock.val.ind.pb"], ["dividend_yield_pct", "stock.val.ind.dividendYield", "%"], ["payout_ratio_pct", "stock.val.ind.payoutRatio", "%"],
  ["ev_ebitda", "stock.val.ind.evEbitda"], ["net_debt_to_ebitda", "stock.val.ind.netDebtToEbitda"],
];

const INPUTS: [string, MessageKey, "money" | "pct" | "mil"][] = [
  ["eps", "stock.val.input.eps", "money"], ["bvps", "stock.val.input.bvps", "money"], ["fcf_per_share", "stock.val.input.fcfPerShare", "money"],
  ["dividend_per_share", "stock.val.input.dividendPerShare", "money"], ["eps_growth_5y", "stock.val.input.epsGrowth5y", "pct"],
  ["revenue_growth_5y", "stock.val.input.revenueGrowth5y", "pct"], ["shares_outstanding", "stock.val.input.shares", "mil"],
  ["ebitda", "stock.val.input.ebitda", "mil"], ["net_debt", "stock.val.input.netDebt", "mil"],
];

const VERDICT_TONE: Record<string, string> = {
  "below buy price": "reached", "below fair value": "ok", "near fair value": "", "above fair value": "above_max",
};

const VERDICT: Record<string, MessageKey> = {
  "below buy price": "stock.val.verdict.belowBuy", "below fair value": "stock.val.verdict.belowFair",
  "near fair value": "stock.val.verdict.nearFair", "above fair value": "stock.val.verdict.aboveFair",
  "insufficient data": "stock.val.verdict.insufficient",
};

const BAND: Record<string, MessageKey> = { strong: "stock.val.band.strong", average: "stock.val.band.average", weak: "stock.val.band.weak" };

const ZONE: Record<string, MessageKey> = { safe: "stock.val.zone.safe", grey: "stock.val.zone.grey", distress: "stock.val.zone.distress" };

// keyed by the backend's model key; the multiple models carry their multiple in the name, e.g. "P/E multiple (18×)"
const MODEL_NAME: Record<string, MessageKey> = {
  dcf: "stock.val.model.dcf", graham_number: "stock.val.model.grahamNumber", graham_formula: "stock.val.model.grahamFormula",
  lynch: "stock.val.model.lynch", ddm: "stock.val.model.ddm", epv: "stock.val.model.epv",
  pe_multiple: "stock.val.model.peMultiple", ev_ebitda: "stock.val.model.evEbitda",
};
const MULTIPLE_MODELS = new Set(["pe_multiple", "ev_ebitda"]);

function modelName(t: I18n["t"], m: ValModel) {
  const key = MODEL_NAME[m.key];
  if (!key) return m.name;
  if (!MULTIPLE_MODELS.has(m.key)) return t(key);
  const multiple = /\(([\d.]+)×\)/.exec(m.name)?.[1];
  return multiple === undefined ? m.name : t(key, { x: multiple });
}

const zoneLabel = (t: I18n["t"], zone: string) => {
  const key = ZONE[zone];
  return key ? t(key) : t("stock.val.zone.other", { zone });
};

const labelOf = (t: I18n["t"], labels: Record<string, MessageKey>, raw: string) => {
  const key = labels[raw];
  return key ? t(key) : raw;
};

export default function ValuationPanel({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const blank = Object.fromEntries(FIELDS.map((f) => [f.key, String(f.def)]));
  const [form, setForm] = useState<Record<string, string>>(blank);
  const [query, setQuery] = useState("");
  const { data: v, error, loading } = useApi<Valuation>(`/stocks/${symbol}/valuation${query}`);

  const apply = () => {
    const qs = new URLSearchParams(Object.entries(form).filter(([, val]) => val !== ""));
    setQuery(`?${qs}`);
  };

  const s = v?.summary;
  const chart = v?.models.flatMap((m) => m.value ? [{ name: modelName(t, m).replace(/ \(.*\)/, ""), value: m.value }] : []) ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      {error && <div className="err">{error}</div>}

      <div className="grid g4">
        <Tile label={t("common.price")} value={money(v?.price)} />
        <Tile label={t("stock.val.fairValue", { n: s?.models_used ?? 0 })} value={money(s?.fair_value)}
          sub={s?.low ? t("stock.val.range", { low: money(s.low), high: money(s.high) }) : undefined} />
        <Tile label={t("stock.val.buyBelow", { pct: form.margin_of_safety || 25 })} value={money(s?.buy_below)} />
        <Tile label={t("stock.val.upside")} value={pct(s?.upside_pct)} tone={tone(s?.upside_pct)}
          sub={s && <span className={`chip ${VERDICT_TONE[s.verdict] ?? ""}`}>{labelOf(t, VERDICT, s.verdict)}</span>} />
      </div>

      <div className="grid g3">
        <div className="card span2">
          <h2>{t("stock.val.models")} {loading && <span className="sub">{t("stock.val.updating")}</span>}</h2>
          {chart.length > 0 && (
            <div style={{ height: Math.max(180, chart.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" margin={{ left: 40, right: 24 }}>
                  <XAxis type="number" stroke="#8b909a" fontSize={11} tickFormatter={(x) => `$${x}`} />
                  <YAxis type="category" dataKey="name" stroke="#8b909a" fontSize={12} width={150} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(x: number) => money(x)} cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "#14171c", border: "1px solid #262a32", borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chart.map((c, i) => <Cell key={i} fill={v && c.value >= v.price ? "#49c58c" : "#ec6650"} fillOpacity={0.75} />)}
                  </Bar>
                  {v && <ReferenceLine x={v.price} stroke="#ece8df" strokeDasharray="4 3" label={{ value: t("stock.val.priceMark"), fill: "#ece8df", fontSize: 11, position: "top" }} />}
                  {s?.fair_value && <ReferenceLine x={s.fair_value} stroke="#e8b04a" label={{ value: t("stock.val.fairMark"), fill: "#e8b04a", fontSize: 11, position: "top" }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="scroll-x">
            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>{t("stock.val.col.model")}</th><th className="n">{t("common.value")}</th>
                  <th className="n">{t("stock.val.col.vsPrice")}</th><th>{t("stock.val.col.how")}</th>
                </tr>
              </thead>
              <tbody>
                {v?.models.map((m) => (
                  <tr key={m.key} style={{ opacity: m.value ? 1 : 0.55 }}>
                    <td>{modelName(t, m)}</td>
                    <td className="n">{money(m.value)}</td>
                    <td className={`n ${tone(m.upside_pct)}`}>{pct(m.upside_pct)}</td>
                    <td className="sub" style={{ fontSize: 12 }}>{m.skipped ?? m.formula}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>{t("stock.val.assumptions")}</h2>
          <div className="grid" style={{ gap: 8 }}>
            {FIELDS.map((f) => (
              <label key={f.key} className="f">
                <span>{t(f.label)} <span style={{ opacity: 0.6 }}>· {t(f.hint)}</span></span>
                <input type="number" step="any" value={form[f.key]} placeholder={f.key === "growth_rate" && v ? String(v.assumptions.growth_rate) : ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply()} />
              </label>
            ))}
            {v && <div className="sub" style={{ fontSize: 12 }}>{t("stock.val.growthUsed", { growth: share(v.assumptions.growth_rate as number), source: v.assumptions.growth_source })}</div>}
            <div className="row">
              <button className="btn" onClick={() => { setForm(blank); setQuery(""); }}>{t("stock.val.reset")}</button>
              <button className="btn primary" onClick={apply}>{t("stock.val.recalculate")}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g3">
        <div className="card">
          <h2>{t("stock.val.indicators")}</h2>
          {INDICATORS.map(([k, label, unit]) => <KV key={k} label={t(label)} value={unit ? share(v?.indicators[k]) : num(v?.indicators[k])} />)}
        </div>

        <div className="card">
          <h2>{t("stock.val.quality")}</h2>
          {v && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span>{t("stock.val.piotroski")}</span>
                <span className="num" style={{ fontSize: 20 }}>{v.quality.piotroski.score ?? "—"}<span className="sub">/9</span></span>
              </div>
              {v.quality.piotroski.band && <span className={`chip ${v.quality.piotroski.band === "strong" ? "ok" : v.quality.piotroski.band === "weak" ? "below_min" : ""}`}>{labelOf(t, BAND, v.quality.piotroski.band)}</span>}
              {v.quality.piotroski.skipped && <div className="sub" style={{ fontSize: 12 }}>{v.quality.piotroski.skipped}</div>}
              <div style={{ margin: "8px 0 14px" }}>
                {v.quality.piotroski.checks.map((c) => (
                  <div key={c.name} style={{ fontSize: 12, padding: "2px 0" }}>
                    <span className={c.pass ? "up" : "down"}>{c.pass ? "✓" : "✗"}</span> {c.name}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <span>{t("stock.val.altman")}</span>
                <span className="num" style={{ fontSize: 20 }}>{v.quality.altman_z.score ?? "—"}</span>
              </div>
              {v.quality.altman_z.zone && (
                <span className={`chip ${v.quality.altman_z.zone === "safe" ? "ok" : v.quality.altman_z.zone === "distress" ? "below_min" : ""}`}>{zoneLabel(t, v.quality.altman_z.zone)}</span>
              )}
              <div className="sub" style={{ fontSize: 11, marginTop: 4 }}>{v.quality.altman_z.skipped ?? t("stock.val.zoneLegend")}</div>
            </>
          )}
        </div>

        <div className="card">
          <h2>{t("stock.val.inputs")}</h2>
          {INPUTS.map(([k, label, kind]) => {
            const x = v?.inputs[k];
            return <KV key={k} label={t(label)} value={kind === "money" ? money(x) : kind === "pct" ? share(x) : num(x, 0)} />;
          })}
          {v && <div className="sub" style={{ fontSize: 11, marginTop: 6 }}>{t(isSampleData(v.data_source) ? "stock.val.sourceSample" : "stock.val.source", { source: v.data_source })}</div>}
        </div>
      </div>
      {v && <div className="sub" style={{ fontSize: 12 }}>{v.disclaimer}</div>}
    </div>
  );
}

function Tile({ label, value, sub, tone: t = "" }: { label: string; value: string; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${t}`}>{value}</div>
      {sub && <div className="delta sub">{sub}</div>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
      <span className="sub">{label}</span><span className="num">{value}</span>
    </div>
  );
}
