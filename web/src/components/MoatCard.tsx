"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MoatMetrics, SafetyArea } from "@/lib/api";
import { ltr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { GradeBadge } from "./SafetyBits";

const TT = { background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8 };
const AX = { stroke: "var(--chart-axis)", fontSize: 11, tickLine: false, axisLine: false } as const;

function pctOrDash(v: number | null, digits = 1) {
  return v == null ? "—" : ltr(`${v.toFixed(digits)}%`);
}

export default function MoatCard({ moat, area }: { moat: MoatMetrics | null; area: SafetyArea | undefined }) {
  const { t } = useI18n();
  const [emptyBefore, emptyAfter] = t("risk.moat.empty", { key: "\u0000" }).split("\u0000");
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{t("risk.moat.title")}</h2>
        {area && <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="sub">{t("risk.moat.label")}</span><GradeBadge grade={area.grade} /></span>}
      </div>
      {!moat ? (
        <div className="empty">
          {emptyBefore}<code>FMP_API_KEY</code>{emptyAfter}
        </div>
      ) : (
        <>
          <div className="grid g4" style={{ marginBottom: 10 }}>
            <Fact label={t("risk.moat.avgRoic")} value={pctOrDash(moat.roic_avg_pct)}
              sub={moat.roic_consistency == null ? "" : t("risk.moat.roicConsistency", { pct: `${Math.round(moat.roic_consistency * 100)}%` })} />
            <Fact label={t("risk.moat.grossMargin")} value={pctOrDash(moat.gross_margin_avg_pct)}
              sub={moat.gross_margin_std_pp == null ? "" : t("risk.moat.marginSpread", { pp: ltr(`±${moat.gross_margin_std_pp.toFixed(1)}pp`) })} />
            <Fact label={t("risk.moat.revenueGrowth")} value={pctOrDash(moat.revenue_cagr_pct)}
              sub={moat.growth_consistency == null ? "" : t("risk.moat.growthConsistency", { pct: `${Math.round(moat.growth_consistency * 100)}%` })} />
            <Fact label={t("risk.moat.history")} value={t("risk.moat.years", { n: moat.years })} sub={t("risk.moat.annualStatements")} />
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={moat.series}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="year" {...AX} />
                <YAxis {...AX} tickFormatter={(x) => `${x}%`} />
                <Tooltip contentStyle={TT} formatter={(x: number) => `${x}%`} cursor={{ fill: "var(--chart-cursor)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={10} stroke="var(--up)" strokeDasharray="4 3" label={{ value: t("risk.moat.roicLine"), fill: "var(--up)", fontSize: 11, position: "insideTopLeft" }} />
                <Bar dataKey="roic_pct" name={t("risk.moat.returnOnCapital")} fill="var(--accent)" radius={[3, 3, 0, 0]} />
                <Line dataKey="gross_margin_pct" name={t("risk.moat.grossMargin")} stroke="var(--blue)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="sub" style={{ fontSize: 12 }}>
            {t("risk.moat.footnote")}
          </div>
        </>
      )}
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 18 }}>{value}</div>
      {sub && <div className="delta sub" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}
