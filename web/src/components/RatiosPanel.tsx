"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Ratios } from "@/lib/api";
import { num, share } from "@/lib/format";
import { useI18n, type I18n, type MessageKey } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { isSampleData } from "@/lib/dataSource";

const GROUPS: { title: MessageKey; keys: [string, MessageKey, "%"?][] }[] = [
  { title: "stock.ratios.group.valuation", keys: [["pe", "stock.ratio.pe"], ["forward_pe", "stock.ratio.forwardPe"], ["pb", "stock.ratio.pb"], ["ps", "stock.ratio.ps"], ["peg", "stock.ratio.peg"], ["eps", "stock.ratio.eps"]] },
  { title: "stock.ratios.group.profitability", keys: [["roe", "stock.ratio.roe", "%"], ["roa", "stock.ratio.roa", "%"], ["gross_margin", "stock.ratio.grossMargin", "%"], ["net_margin", "stock.ratio.netMargin", "%"]] },
  { title: "stock.ratios.group.health", keys: [["debt_to_equity", "stock.ratio.debtToEquity"], ["current_ratio", "stock.ratio.currentRatio"], ["dividend_yield", "stock.ratio.dividendYield", "%"], ["beta", "stock.ratio.beta"]] },
];
const VALUATION_LABEL: Record<string, MessageKey> = Object.fromEntries(GROUPS[0]?.keys.map(([k, label]) => [k, label]) ?? []);
const PRICE: [string, MessageKey, "%"?][] = [
  ["total_return_pct", "stock.ratio.return", "%"], ["volatility_pct", "stock.ratio.volatility", "%"], ["max_drawdown_pct", "stock.ratio.maxDrawdown", "%"],
  ["sharpe", "stock.ratio.sharpe"], ["sortino", "stock.ratio.sortino"], ["rsi14", "stock.ratio.rsi14"], ["sma50", "stock.ratio.sma50"], ["sma200", "stock.ratio.sma200"],
];
const LOOKBACK = [90, 365, 1095, 1825];

const lookbackLabel = (t: I18n["t"], days: number) =>
  days < 365 ? t("stock.range.months", { n: days / 30 }) : t("stock.range.years", { n: days / 365 });

function Cellv({ label, v, unit }: { label: string; v: number | null | undefined; unit?: "%" }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span className="sub">{label}</span>
      <span className="num">{v == null ? "—" : unit ? share(v) : num(v)}</span>
    </div>
  );
}

export default function RatiosPanel({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const [lb, setLb] = useState(365);
  const { data, error } = useApi<Ratios>(`/stocks/${symbol}/ratios?lookback_days=${lb}`);
  const f = data?.fundamental ?? {};
  const bars = (["pe", "forward_pe", "pb", "ps", "peg"] as const)
    .filter((k) => f[k] != null)
    .map((k) => {
      const label = VALUATION_LABEL[k];
      return { name: label ? t(label) : k, value: f[k] as number };
    });

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t("stock.ratios.title")}</h2>
        <div className="seg" style={{ flex: "0 1 auto" }}>
          {LOOKBACK.map((d) => (
            <button key={d} className={`btn sm ${d === lb ? "on" : ""}`} onClick={() => setLb(d)}>{lookbackLabel(t, d)}</button>
          ))}
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      <div className="grid g4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>{t(g.title)}</div>
            {g.keys.map(([k, label, unit]) => <Cellv key={k} label={t(label)} v={f[k]} unit={unit} />)}
          </div>
        ))}
        <div>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>{t("stock.ratios.priceRisk", { period: lookbackLabel(t, lb) })}</div>
          {PRICE.map(([k, label, unit]) => <Cellv key={k} label={t(label)} v={data?.price[k]} unit={unit} />)}
        </div>
      </div>
      {isSampleData(data?.data_source) && <div className="sub" style={{ fontSize: 11, marginTop: 6 }}>{t("stock.ratios.sample")}</div>}
      {bars.length > 0 && (
        <div style={{ height: 160, marginTop: 14 }}>
          <ResponsiveContainer>
            <BarChart data={bars} margin={{ left: -20 }}>
              <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--chart-cursor)" }} contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {bars.map((_, i) => <Cell key={i} fill={i === 0 ? "var(--accent)" : "var(--chart-neutral)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
