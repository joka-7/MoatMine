"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Valuation } from "@/lib/api";
import { money, num, pct, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { isSampleData } from "@/lib/dataSource";

const FIELDS: { key: string; label: string; hint: string; def: number | "" }[] = [
  { key: "discount_rate", label: "Discount rate %", hint: "your required return", def: 9 },
  { key: "growth_rate", label: "Growth % (stage 1)", hint: "blank = 5y EPS growth", def: "" },
  { key: "terminal_growth", label: "Terminal growth %", hint: "after stage 1", def: 2.5 },
  { key: "years", label: "Years (stage 1)", hint: "DCF horizon", def: 10 },
  { key: "margin_of_safety", label: "Margin of safety %", hint: "discount for buy price", def: 25 },
  { key: "bond_yield", label: "AAA bond yield %", hint: "Graham formula", def: 4.5 },
  { key: "pe_multiple", label: "Fair P/E", hint: "P/E model", def: 18 },
  { key: "ev_ebitda_multiple", label: "Fair EV/EBITDA", hint: "EV model", def: 12 },
  { key: "dividend_growth", label: "Dividend growth %", hint: "DDM", def: 4 },
];

const INDICATORS: [string, string, string?][] = [
  ["pe", "P/E"], ["peg", "PEG"], ["earnings_yield_pct", "Earnings yield", "%"], ["fcf_yield_pct", "FCF yield", "%"],
  ["p_fcf", "P/FCF"], ["pb", "P/B"], ["dividend_yield_pct", "Dividend yield", "%"], ["payout_ratio_pct", "Payout ratio", "%"],
  ["ev_ebitda", "EV/EBITDA"], ["net_debt_to_ebitda", "Net debt/EBITDA"],
];

const INPUTS: [string, string, "money" | "pct" | "mil"][] = [
  ["eps", "EPS (TTM)", "money"], ["bvps", "Book value/share", "money"], ["fcf_per_share", "FCF/share", "money"],
  ["dividend_per_share", "Dividend/share", "money"], ["eps_growth_5y", "EPS growth 5y", "pct"],
  ["revenue_growth_5y", "Revenue growth 5y", "pct"], ["shares_outstanding", "Shares (M)", "mil"],
  ["ebitda", "EBITDA (M)", "mil"], ["net_debt", "Net debt (M)", "mil"],
];

const VERDICT_TONE: Record<string, string> = {
  "below buy price": "reached", "below fair value": "ok", "near fair value": "", "above fair value": "above_max",
};

export default function ValuationPanel({ symbol }: { symbol: string }) {
  const blank = Object.fromEntries(FIELDS.map((f) => [f.key, String(f.def)]));
  const [form, setForm] = useState<Record<string, string>>(blank);
  const [query, setQuery] = useState("");
  const { data: v, error, loading } = useApi<Valuation>(`/stocks/${symbol}/valuation${query}`);

  const apply = () => {
    const qs = new URLSearchParams(Object.entries(form).filter(([, val]) => val !== ""));
    setQuery(`?${qs}`);
  };

  const s = v?.summary;
  const chart = v?.models.flatMap((m) => m.value ? [{ name: m.name.replace(/ \(.*\)/, ""), value: m.value }] : []) ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      {error && <div className="err">{error}</div>}

      <div className="grid g4">
        <Tile label="Price" value={money(v?.price)} />
        <Tile label={`Fair value · median of ${s?.models_used ?? 0}`} value={money(s?.fair_value)}
          sub={s?.low ? `range ${money(s.low)} – ${money(s.high)}` : undefined} />
        <Tile label={`Buy below · ${form.margin_of_safety || 25}% safety`} value={money(s?.buy_below)} />
        <Tile label="Upside to fair value" value={pct(s?.upside_pct)} tone={tone(s?.upside_pct)}
          sub={s && <span className={`chip ${VERDICT_TONE[s.verdict] ?? ""}`}>{s.verdict}</span>} />
      </div>

      <div className="grid g3">
        <div className="card span2">
          <h2>Models {loading && <span className="sub">· updating…</span>}</h2>
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
                  {v && <ReferenceLine x={v.price} stroke="#ece8df" strokeDasharray="4 3" label={{ value: "price", fill: "#ece8df", fontSize: 11, position: "top" }} />}
                  {s?.fair_value && <ReferenceLine x={s.fair_value} stroke="#e8b04a" label={{ value: "fair", fill: "#e8b04a", fontSize: 11, position: "top" }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="scroll-x">
            <table style={{ marginTop: 8 }}>
              <thead><tr><th>Model</th><th className="n">Value</th><th className="n">vs price</th><th>How</th></tr></thead>
              <tbody>
                {v?.models.map((m) => (
                  <tr key={m.key} style={{ opacity: m.value ? 1 : 0.55 }}>
                    <td>{m.name}</td>
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
          <h2>Assumptions</h2>
          <div className="grid" style={{ gap: 8 }}>
            {FIELDS.map((f) => (
              <label key={f.key} className="f">
                <span>{f.label} <span style={{ opacity: 0.6 }}>· {f.hint}</span></span>
                <input type="number" step="any" value={form[f.key]} placeholder={f.key === "growth_rate" && v ? String(v.assumptions.growth_rate) : ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply()} />
              </label>
            ))}
            {v && <div className="sub" style={{ fontSize: 12 }}>Growth used: {num(v.assumptions.growth_rate as number)}% ({v.assumptions.growth_source})</div>}
            <div className="row">
              <button className="btn" onClick={() => { setForm(blank); setQuery(""); }}>Reset</button>
              <button className="btn primary" onClick={apply}>Recalculate</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g3">
        <div className="card">
          <h2>Indicators</h2>
          {INDICATORS.map(([k, label, unit]) => <KV key={k} label={label} value={v?.indicators[k] == null ? "—" : `${num(v.indicators[k])}${unit ?? ""}`} />)}
        </div>

        <div className="card">
          <h2>Quality</h2>
          {v && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span>Piotroski F-score</span>
                <span className="num" style={{ fontSize: 20 }}>{v.quality.piotroski.score ?? "—"}<span className="sub">/9</span></span>
              </div>
              {v.quality.piotroski.band && <span className={`chip ${v.quality.piotroski.band === "strong" ? "ok" : v.quality.piotroski.band === "weak" ? "below_min" : ""}`}>{v.quality.piotroski.band}</span>}
              {v.quality.piotroski.skipped && <div className="sub" style={{ fontSize: 12 }}>{v.quality.piotroski.skipped}</div>}
              <div style={{ margin: "8px 0 14px" }}>
                {v.quality.piotroski.checks.map((c) => (
                  <div key={c.name} style={{ fontSize: 12, padding: "2px 0" }}>
                    <span className={c.pass ? "up" : "down"}>{c.pass ? "✓" : "✗"}</span> {c.name}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <span>Altman Z-score</span>
                <span className="num" style={{ fontSize: 20 }}>{v.quality.altman_z.score ?? "—"}</span>
              </div>
              {v.quality.altman_z.zone && (
                <span className={`chip ${v.quality.altman_z.zone === "safe" ? "ok" : v.quality.altman_z.zone === "distress" ? "below_min" : ""}`}>{v.quality.altman_z.zone} zone</span>
              )}
              <div className="sub" style={{ fontSize: 11, marginTop: 4 }}>{v.quality.altman_z.skipped ?? "> 2.99 safe · 1.81–2.99 grey · < 1.81 distress"}</div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Inputs used</h2>
          {INPUTS.map(([k, label, kind]) => {
            const x = v?.inputs[k];
            return <KV key={k} label={label} value={x == null ? "—" : kind === "money" ? money(x) : kind === "pct" ? `${num(x)}%` : num(x, 0)} />;
          })}
          {v && <div className="sub" style={{ fontSize: 11, marginTop: 6 }}>Source: {v.data_source}{isSampleData(v.data_source) ? " (sample data)" : ""}</div>}
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
