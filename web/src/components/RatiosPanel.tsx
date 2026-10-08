"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Ratios } from "@/lib/api";
import { num } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { isSampleData } from "@/lib/dataSource";

const GROUPS: { title: string; keys: [string, string, string?][] }[] = [
  { title: "Valuation", keys: [["pe", "P/E"], ["forward_pe", "Fwd P/E"], ["pb", "P/B"], ["ps", "P/S"], ["peg", "PEG"], ["eps", "EPS"]] },
  { title: "Profitability", keys: [["roe", "ROE", "%"], ["roa", "ROA", "%"], ["gross_margin", "Gross margin", "%"], ["net_margin", "Net margin", "%"]] },
  { title: "Health & income", keys: [["debt_to_equity", "Debt/Equity"], ["current_ratio", "Current ratio"], ["dividend_yield", "Div. yield", "%"], ["beta", "Beta"]] },
];
const VALUATION_LABEL: Record<string, string> = Object.fromEntries(GROUPS[0]?.keys.map(([k, label]) => [k, label]) ?? []);
const PRICE: [string, string, string?][] = [
  ["total_return_pct", "Return", "%"], ["volatility_pct", "Volatility (ann.)", "%"], ["max_drawdown_pct", "Max drawdown", "%"],
  ["sharpe", "Sharpe"], ["sortino", "Sortino"], ["rsi14", "RSI 14"], ["sma50", "SMA 50"], ["sma200", "SMA 200"],
];
const LOOKBACK = [90, 365, 1095, 1825];

function Cellv({ label, v, unit }: { label: string; v: number | null | undefined; unit?: string }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span className="sub">{label}</span>
      <span className="num">{v == null ? "—" : `${num(v)}${unit ?? ""}`}</span>
    </div>
  );
}

export default function RatiosPanel({ symbol }: { symbol: string }) {
  const [lb, setLb] = useState(365);
  const { data, error } = useApi<Ratios>(`/stocks/${symbol}/ratios?lookback_days=${lb}`);
  const f = data?.fundamental ?? {};
  const bars = (["pe", "forward_pe", "pb", "ps", "peg"] as const)
    .filter((k) => f[k] != null)
    .map((k) => ({ name: VALUATION_LABEL[k] ?? k, value: f[k] as number }));

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Ratios</h2>
        <div className="seg" style={{ flex: "0 1 auto" }}>
          {LOOKBACK.map((d) => (
            <button key={d} className={`btn sm ${d === lb ? "on" : ""}`} onClick={() => setLb(d)}>{d < 365 ? `${d / 30}M` : `${d / 365}Y`}</button>
          ))}
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      <div className="grid g4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>{g.title}</div>
            {g.keys.map(([k, label, unit]) => <Cellv key={k} label={label} v={f[k]} unit={unit} />)}
          </div>
        ))}
        <div>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Price & risk ({lb < 365 ? `${lb / 30}M` : `${lb / 365}Y`})</div>
          {PRICE.map(([k, label, unit]) => <Cellv key={k} label={label} v={data?.price[k]} unit={unit} />)}
        </div>
      </div>
      {isSampleData(data?.data_source) && <div className="sub" style={{ fontSize: 11, marginTop: 6 }}>Price &amp; risk figures use sample data, not real prices.</div>}
      {bars.length > 0 && (
        <div style={{ height: 160, marginTop: 14 }}>
          <ResponsiveContainer>
            <BarChart data={bars} margin={{ left: -20 }}>
              <XAxis dataKey="name" stroke="#8b909a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#8b909a" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#14171c", border: "1px solid #262a32", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {bars.map((_, i) => <Cell key={i} fill={i === 0 ? "#e8b04a" : "#3a404a"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
