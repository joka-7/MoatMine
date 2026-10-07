"use client";

import Link from "next/link";
import BookToggle, { PaperNotice } from "@/components/BookToggle";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PortfolioRisk, StressReport } from "@/lib/api";
import { money, num, pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { useBookMode } from "@/lib/useBookMode";

const TT = { background: "#14171c", border: "1px solid #262a32", borderRadius: 8 };

function corrColor(c: number | null) {
  if (c == null) return "transparent";
  const a = Math.min(1, Math.abs(c));
  return c >= 0 ? `rgba(236,102,80,${a * 0.8})` : `rgba(106,165,255,${a * 0.8})`;
}

export default function RiskPage() {
  const [mode, setMode] = useBookMode();
  const { data: r, error } = useApi<PortfolioRisk>(`/safety/portfolio?mode=${mode}`);
  const { data: s } = useApi<StressReport>(`/safety/stress?mode=${mode}`);

  const tiles: [string, string, string?][] = r ? [
    ["Volatility", r.volatility_pct == null ? "—" : `${num(r.volatility_pct)}%/yr`, "how much the portfolio swings"],
    ["Beta vs S&P 500", num(r.beta), "1 = moves with the market"],
    ["Value at risk · 1 month", money(r.var95_1m), "a bad month (1 in 20) could cost about this"],
    ["Worst fall · 1y", pct(r.max_drawdown_pct), "peak to bottom, current holdings"],
    ["Largest position", r.top_position_pct == null ? "—" : `${num(r.top_position_pct)}%`, `limit ${r.rules.max_position_pct}%`],
    ["Effective holdings", num(r.effective_holdings, 1), `of ${r.holdings_count} — lower means concentrated`],
    ["Avg correlation", num(r.avg_correlation), "near 1 = holdings move together"],
    ["Cash", `${num(r.cash_pct)}%`, money(r.total_value) + " total"],
  ] : [];

  const sectors = r ? Object.entries(r.sectors).map(([name, value]) => ({ name, value })) : [];
  const stress = s?.scenarios.map((x) => ({ name: x.name.replace(/ (crash|crisis|sell-off|bear market).*/i, ""), value: x.change_pct, breach: x.breaches_limit })) ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Portfolio risk</h1>
          <div className="sub">Measured against <Link href="/risk-profile" style={{ textDecoration: "underline" }}>your risk profile</Link>.</div>
        </div>
        <BookToggle mode={mode} onChange={setMode} />
      </div>
      {mode === "paper" && <PaperNotice />}
      {error && <div className="err" style={{ marginBottom: 16 }}>{error}</div>}
      {r && r.holdings_count === 0 && <div className="card empty" style={{ marginBottom: 16 }}>Add holdings to see portfolio risk.</div>}
      {r?.data_source.startsWith("mock") && <div className="sub" style={{ fontSize: 12, marginBottom: 12 }}>Risk numbers below use sample price data, not real history.</div>}

      {!!r?.breaches.length && (
        <div className="card" style={{ marginBottom: 16, borderColor: "color-mix(in srgb, var(--down) 40%, var(--line))" }}>
          <h2 style={{ color: "var(--down)" }}>Rule breaches</h2>
          {r.breaches.map((b) => <div key={b.rule + b.subject}>⚠ {b.message}</div>)}
        </div>
      )}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card stat">
            <div className="label">{label}</div>
            <div className="value" style={{ fontSize: 20 }}>{value}</div>
            {sub && <div className="delta sub" style={{ fontSize: 12 }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Sectors</h2>
          {sectors.length > 0 && r && (
            <div style={{ height: Math.max(160, sectors.length * 32) }}>
              <ResponsiveContainer>
                <BarChart data={sectors} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <XAxis type="number" stroke="#8b909a" fontSize={11} tickFormatter={(x) => `${x}%`} />
                  <YAxis type="category" dataKey="name" stroke="#8b909a" fontSize={12} width={120} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} formatter={(x: number) => `${x}%`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <ReferenceLine x={r.rules.max_sector_pct} stroke="#ec6650" strokeDasharray="4 3" label={{ value: "limit", fill: "#ec6650", fontSize: 11, position: "top" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sectors.map((x) => <Cell key={x.name} fill={x.value > r.rules.max_sector_pct ? "#ec6650" : "#e8b04a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card">
          <h2>How your holdings move together</h2>
          {r && r.correlation.symbols.length > 1 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "auto" }}>
                <thead><tr><th />{r.correlation.symbols.map((x) => <th key={x} className="n">{x}</th>)}</tr></thead>
                <tbody>
                  {r.correlation.matrix.map((row, i) => (
                    <tr key={r.correlation.symbols[i]}>
                      <td className="sym">{r.correlation.symbols[i]}</td>
                      {row.map((c, j) => (
                        <td key={j} className="n" style={{ background: corrColor(c), minWidth: 52 }}>{c == null ? "—" : c.toFixed(2)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sub" style={{ fontSize: 12, marginTop: 6 }}>Red: move together (less protection). Blue: move opposite (more protection).</div>
            </div>
          ) : <div className="empty">Needs two or more holdings.</div>}
        </div>
      </div>

      <div className="card">
        <h2>Stress tests · today&apos;s portfolio in bad times</h2>
        {s && (
          <>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={stress} margin={{ bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#8b909a" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#8b909a" fontSize={11} tickFormatter={(x) => `${x}%`} />
                  <Tooltip contentStyle={TT} formatter={(x: number) => `${x}%`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <ReferenceLine y={s.loss_limit_pct} stroke="#ec6650" strokeDasharray="4 3" label={{ value: `your limit ${s.loss_limit_pct}%`, fill: "#ec6650", fontSize: 11, position: "insideBottomRight" }} />
                  <Bar dataKey="value" radius={[0, 0, 4, 4]}>
                    {stress.map((x) => <Cell key={x.name} fill={x.breach ? "#ec6650" : "#3a404a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="scroll-x">
              <table>
                <thead><tr><th>Scenario</th><th className="n">Portfolio change</th><th>Biggest hits</th></tr></thead>
                <tbody>
                  {s.scenarios.map((x) => (
                    <tr key={x.key}>
                      <td>{x.name} <span className="sub" style={{ fontSize: 11 }}>{x.kind}</span></td>
                      <td className={`n ${x.breaches_limit ? "down" : ""}`}>{money(x.change)} ({pct(x.change_pct)}){x.breaches_limit && " ⚠"}</td>
                      <td className="sub" style={{ fontSize: 12 }}>{x.worst.map((w) => `${w.symbol} ${pct(w.change_pct)}${w.basis !== "actual fall" ? "*" : ""}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sub" style={{ fontSize: 12, marginTop: 6 }}>* estimated from the stock&apos;s beta (not listed then, or a hypothetical fall). {s.note}{s.data_source.startsWith("mock") ? " Sample data." : ""}</div>
          </>
        )}
      </div>
    </>
  );
}
