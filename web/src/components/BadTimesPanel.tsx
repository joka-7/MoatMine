"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadTimes } from "@/lib/api";
import { date, pct, share } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { isSampleData } from "@/lib/dataSource";
import { useI18n, type I18n } from "@/lib/i18n";

const TT = { background: "#14171c", border: "1px solid #262a32", borderRadius: 8 };
const AX = { stroke: "#8b909a", fontSize: 11, tickLine: false, axisLine: false } as const;

function span(t: I18n["t"], days: number | null) {
  if (days == null) return "—";
  if (days < 60) return t("stock.bad.days", { n: days });
  if (days < 730) return t("stock.bad.months", { n: Math.round(days / 30) });
  return t("stock.bad.years", { n: (days / 365).toFixed(1) });
}

export default function BadTimesPanel({ symbol }: { symbol: string }) {
  const { t, lang } = useI18n();
  const [bench, setBench] = useState("SPY");
  const [input, setInput] = useState("SPY");
  const { data: d, error } = useApi<BadTimes>(`/stocks/${symbol}/crises?benchmark=${bench}`);
  const r = d?.resilience;
  const chart = d?.crises.flatMap((c) => c.stock ? [{
    name: c.name.replace(/ (crash|crisis|sell-off|bear market).*/i, ""),
    [symbol]: c.stock.drawdown_pct,
    [bench]: c.benchmark?.drawdown_pct ?? null,
  }] : []) ?? [];
  const captureTone = r?.downside_capture_pct == null ? "" : r.downside_capture_pct <= 80 ? "up" : r.downside_capture_pct > 120 ? "down" : "";

  return (
    <div className="grid" style={{ gap: 16 }}>
      {error && <div className="err">{error}</div>}
      <div className="grid g4">
        <div className="card stat">
          <div className="label">{t("stock.bad.capture", { bench })}</div>
          <div className={`value ${captureTone}`}>{share(r?.downside_capture_pct)}</div>
          <div className="delta sub">{r?.label}</div>
        </div>
        <div className="card stat">
          <div className="label">{t("stock.bad.avgDrawdown")}</div>
          <div className="value down">{pct(r?.avg_drawdown_pct)}</div>
          <div className="delta sub">{bench}: {pct(r?.avg_benchmark_drawdown_pct)}</div>
        </div>
        <div className="card stat">
          <div className="label">{t("stock.bad.recovered")}</div>
          <div className="value">{r ? `${r.recovered_count ?? 0}/${r.crises_covered}` : "—"}</div>
          <div className="delta sub">{t("stock.bad.recoveredHint")}</div>
        </div>
        <div className="card stat">
          <div className="label">{t("stock.bad.benchmark")}</div>
          <form className="row" style={{ marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); setBench(input.trim().toUpperCase() || "SPY"); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} style={{ maxWidth: 110 }} />
            <button className="btn sm">{t("stock.bad.compare")}</button>
          </form>
          {d?.history_from && <div className="delta sub">{t("stock.bad.historyFrom", { date: date(d.history_from, lang) })}</div>}
        </div>
      </div>

      <div className="card">
        <h2>{t("stock.bad.chartTitle", { symbol, bench })}</h2>
        {!chart.length ? <div className="empty">{t("stock.bad.noHistory")}</div> : (
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
              <tr>
                <th>{t("stock.bad.col.crisis")}</th><th>{t("stock.bad.col.period")}</th><th className="n">{t("stock.bad.col.fall", { symbol })}</th>
                <th className="n">{t("stock.bad.col.fall", { symbol: bench })}</th><th className="n">{t("stock.bad.col.backToPrice")}</th>
              </tr>
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
                      <td className="n">{c.stock.recovered ? span(t, c.stock.recovery_days) : <span className="down">{t("stock.bad.notYet", { pct: pct(c.stock.still_below_pct) })}</span>}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="sub" style={{ textAlign: "end" }}>{t("stock.bad.notListed")}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>{t("stock.bad.worstTitle", { symbol })}</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>{t("stock.bad.col.peak")}</th><th>{t("stock.bad.col.bottom")}</th><th className="n">{t("stock.bad.col.depth")}</th>
                <th className="n">{t("stock.bad.col.timeFalling")}</th><th className="n">{t("stock.bad.col.timeToRecover")}</th>
              </tr>
            </thead>
            <tbody>
              {d?.worst_drawdowns.map((w) => (
                <tr key={w.peak_date}>
                  <td>{date(w.peak_date, lang)}</td><td>{date(w.trough_date, lang)}</td>
                  <td className="n down">{pct(w.depth_pct)}</td>
                  <td className="n">{span(t, w.fall_days)}</td>
                  <td className="n">{w.recovered ? span(t, w.recovery_days) : <span className="down">{t("stock.bad.stillBelow")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d && !d.worst_drawdowns.length && <div className="empty">{t("stock.bad.noFalls")}</div>}
      </div>
      {d && (
        <div className="sub" style={{ fontSize: 12 }}>
          {d.note} {t(isSampleData(d.data_source) ? "stock.bad.sourceSample" : "stock.bad.source", { source: d.data_source })}
        </div>
      )}
    </div>
  );
}
