"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MoatMetrics, SafetyArea } from "@/lib/api";
import { GradeBadge } from "./SafetyBits";

const TT = { background: "#14171c", border: "1px solid #262a32", borderRadius: 8 };
const AX = { stroke: "#8b909a", fontSize: 11, tickLine: false, axisLine: false } as const;

function pctOrDash(v: number | null, digits = 1) {
  return v == null ? "—" : `${v.toFixed(digits)}%`;
}

export default function MoatCard({ moat, area }: { moat: MoatMetrics | null; area: SafetyArea | undefined }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Moat over the years</h2>
        {area && <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="sub">Moat</span><GradeBadge grade={area.grade} /></span>}
      </div>
      {!moat ? (
        <div className="empty">
          Needs 4+ years of annual statements. Add <code>FMP_API_KEY</code> on the backend; until then the Moat grade uses
          the 5-year return-on-capital average only, when the data provider has it.
        </div>
      ) : (
        <>
          <div className="grid g4" style={{ marginBottom: 10 }}>
            <Fact label="Avg return on capital" value={pctOrDash(moat.roic_avg_pct)}
              sub={moat.roic_consistency == null ? "" : `${Math.round(moat.roic_consistency * 100)}% of years ≥ 10%`} />
            <Fact label="Gross margin" value={pctOrDash(moat.gross_margin_avg_pct)}
              sub={moat.gross_margin_std_pp == null ? "" : `±${moat.gross_margin_std_pp.toFixed(1)}pp year to year`} />
            <Fact label="Revenue growth / yr" value={pctOrDash(moat.revenue_cagr_pct)}
              sub={moat.growth_consistency == null ? "" : `grew in ${Math.round(moat.growth_consistency * 100)}% of years`} />
            <Fact label="History" value={`${moat.years} years`} sub="annual statements" />
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={moat.series}>
                <CartesianGrid stroke="#1d2128" vertical={false} />
                <XAxis dataKey="year" {...AX} />
                <YAxis {...AX} tickFormatter={(x) => `${x}%`} />
                <Tooltip contentStyle={TT} formatter={(x: number) => `${x}%`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={10} stroke="#49c58c" strokeDasharray="4 3" label={{ value: "10% ROIC", fill: "#49c58c", fontSize: 11, position: "insideTopLeft" }} />
                <Bar dataKey="roic_pct" name="Return on capital" fill="#e8b04a" radius={[3, 3, 0, 0]} />
                <Line dataKey="gross_margin_pct" name="Gross margin" stroke="#6aa5ff" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="sub" style={{ fontSize: 12 }}>
            A moat shows up as returns on capital that stay high every year, margins that barely move, and revenue that keeps growing.
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
