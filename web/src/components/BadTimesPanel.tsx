"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadTimes } from "@/lib/api";
import { date, pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const TT = { background: "#14171c", border: "1px solid #262a32", borderRadius: 8 };
const AX = { stroke: "#8b909a", fontSize: 11, tickLine: false, axisLine: false } as const;

function span(days: number | null) {
  if (days == null) return "—";
  if (days < 60) return `${days} days`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export default function BadTimesPanel({ symbol }: { symbol: string }) {
  const [bench, setBench] = useState("SPY");
  const [input, setInput] = useState("SPY");
  const { data: d, error } = useApi<BadTimes>(`/stocks/${symbol}/crises?benchmark=${bench}`);
  const r = d?.resilience;
  const chart = d?.crises.filter((c) => c.stock).map((c) => ({
    name: c.name.replace(/ (crash|crisis|sell-off|bear market).*/i, ""),
    [symbol]: c.stock!.drawdown_pct,
    [bench]: c.benchmark?.drawdown_pct ?? null,
  })) ?? [];
  const captureTone = r?.downside_capture_pct == null ? "" : r.downside_capture_pct <= 80 ? "up" : r.downside_capture_pct > 120 ? "down" : "";

  return (
    <div className="grid" style={{ gap: 16 }}>
      {error && <div className="err">{error}</div>}
      <div className="grid g4">
        <div className="card stat">
          <div className="label">Downside capture vs {bench}</div>
          <div className={`value ${captureTone}`}>{r?.downside_capture_pct != null ? `${r.downside_capture_pct}%` : "—"}</div>
          <div className="delta sub">{r?.label}</div>
        </div>
        <div className="card stat">
          <div className="label">Avg crisis drawdown</div>
          <div className="value down">{pct(r?.avg_drawdown_pct)}</div>
          <div className="delta sub">{bench}: {pct(r?.avg_benchmark_drawdown_pct)}</div>
        </div>
        <div className="card stat">
          <div className="label">Recovered</div>
          <div className="value">{r ? `${r.recovered_count ?? 0}/${r.crises_covered}` : "—"}</div>
          <div className="delta sub">crises back to pre-crisis price</div>
        </div>
        <div className="card stat">
          <div className="label">Benchmark</div>
          <form className="row" style={{ marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); setBench(input.trim().toUpperCase() || "SPY"); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} style={{ maxWidth: 110 }} />
            <button className="btn sm">Compare</button>
          </form>
          {d?.history_from && <div className="delta sub">History from {date(d.history_from)}</div>}
        </div>
      </div>

      <div className="card">
        <h2>Drawdown in each crisis · {symbol} vs {bench}</h2>
        {!chart.length ? <div className="empty">No price history through any of these crises.</div> : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid stroke="#1d2128" vertical={false} />
                <XAxis dataKey="name" {...AX} />
                <YAxis {...AX} tickFormatter={(x) => `${x}%`} />
                <Tooltip contentStyle={TT} formatter={(x: number) => `${x}%`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={symbol} fill="#ec6650" radius={[0, 0, 3, 3]} />
                <Bar dataKey={bench} fill="#3a404a" radius={[0, 0, 3, 3]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="scroll-x">
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr><th>Crisis</th><th>Period</th><th className="n">{symbol} fall</th><th className="n">{bench} fall</th><th className="n">Back to pre-crisis price</th></tr>
            </thead>
            <tbody>
              {d?.crises.map((c) => (
                <tr key={c.key}>
                  <td><div>{c.name}</div><div className="sub" style={{ fontSize: 12 }}>{c.description}</div></td>
                  <td className="sub" style={{ whiteSpace: "nowrap" }}>{c.start.slice(0, 7)} → {c.end.slice(0, 7)}</td>
                  {c.stock ? (
                    <>
                      <td className="n down">{pct(c.stock.drawdown_pct)}</td>
                      <td className="n sub">{pct(c.benchmark?.drawdown_pct)}</td>
                      <td className="n">{c.stock.recovered ? span(c.stock.recovery_days) : <span className="down">not yet ({pct(c.stock.still_below_pct)})</span>}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="sub" style={{ textAlign: "right" }}>not listed yet</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>{symbol}&apos;s own worst falls</h2>
        <div className="scroll-x">
          <table>
            <thead><tr><th>Peak</th><th>Bottom</th><th className="n">Fall</th><th className="n">Time falling</th><th className="n">Time to recover</th></tr></thead>
            <tbody>
              {d?.worst_drawdowns.map((w) => (
                <tr key={w.peak_date}>
                  <td>{date(w.peak_date)}</td><td>{date(w.trough_date)}</td>
                  <td className="n down">{pct(w.depth_pct)}</td>
                  <td className="n">{span(w.fall_days)}</td>
                  <td className="n">{w.recovered ? span(w.recovery_days) : <span className="down">still below peak</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d && !d.worst_drawdowns.length && <div className="empty">No falls deeper than 10% in the available history.</div>}
      </div>
      {d && (
        <div className="sub" style={{ fontSize: 12 }}>
          {d.note} Source: {d.data_source}{d.data_source.startsWith("mock") ? " (sample data, not real history)" : ""}.
        </div>
      )}
    </div>
  );
}
