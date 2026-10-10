"use client";

import Link from "next/link";
import BookToggle, { PaperNotice } from "@/components/BookToggle";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PortfolioRisk, StressReport } from "@/lib/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { ltr, money, num, pct, share } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { useBookMode } from "@/lib/useBookMode";
import { isSampleData } from "@/lib/dataSource";

const TT = { background: "#14171c", border: "1px solid #262a32", borderRadius: 8 };
const KIND = { historical: "risk.kind.historical", hypothetical: "risk.kind.hypothetical" } as const satisfies Record<string, MessageKey>;

function corrColor(c: number | null) {
  if (c == null) return "transparent";
  const a = Math.min(1, Math.abs(c));
  return c >= 0 ? `rgba(236,102,80,${a * 0.8})` : `rgba(106,165,255,${a * 0.8})`;
}

export default function RiskPage() {
  const [mode, setMode] = useBookMode();
  const { data: r, error } = useApi<PortfolioRisk>(`/safety/portfolio?mode=${mode}`);
  const { data: s } = useApi<StressReport>(`/safety/stress?mode=${mode}`);
  const { t } = useI18n();

  const tiles: [MessageKey, string, string?][] = r ? [
    ["risk.volatility", r.volatility_pct == null ? "—" : t("risk.perYear", { pct: share(r.volatility_pct) }), t("risk.volatilityHint")],
    ["risk.beta", num(r.beta), t("risk.betaHint")],
    ["risk.var", money(r.var95_1m), t("risk.varHint")],
    ["risk.worstFall", pct(r.max_drawdown_pct), t("risk.worstFallHint")],
    ["risk.largestPosition", share(r.top_position_pct), t("risk.limitHint", { pct: share(r.rules.max_position_pct) })],
    ["risk.effectiveHoldings", num(r.effective_holdings, 1), t("risk.effectiveHoldingsHint", { n: r.holdings_count })],
    ["risk.avgCorrelation", num(r.avg_correlation), t("risk.avgCorrelationHint")],
    ["common.cash", share(r.cash_pct), t("risk.cashHint", { value: money(r.total_value) })],
  ] : [];
  const [measuredBefore, measuredAfter] = t("risk.measuredAgainst", { link: "\u0000" }).split("\u0000");

  const sectors = r ? Object.entries(r.sectors).map(([name, value]) => ({ name, value })) : [];
  const stress = s?.scenarios.map((x) => ({ name: x.name.replace(/ (crash|crisis|sell-off|bear market).*/i, ""), value: x.change_pct, breach: x.breaches_limit })) ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t("risk.title")}</h1>
          <div className="sub">{measuredBefore}<Link href="/risk-profile" style={{ textDecoration: "underline" }}>{t("risk.yourRiskProfile")}</Link>{measuredAfter}</div>
        </div>
        <BookToggle mode={mode} onChange={setMode} />
      </div>
      {mode === "paper" && <PaperNotice />}
      {error && <div className="err" style={{ marginBottom: 16 }}>{error}</div>}
      {r && r.holdings_count === 0 && <div className="card empty" style={{ marginBottom: 16 }}>{t("risk.noHoldings")}</div>}
      {isSampleData(r?.data_source) && <div className="sub" style={{ fontSize: 12, marginBottom: 12 }}>{t("risk.sampleNumbers")}</div>}
      {!!r?.uncovered_pct && (
        <div className="sub" style={{ fontSize: 12, marginBottom: 12 }}>
          {t("risk.uncovered", { symbols: r.uncovered_symbols.join(", "), pct: share(r.uncovered_pct) })}
        </div>
      )}
      {r?.window_limited_by && (
        <div className="sub" style={{ fontSize: 12, marginBottom: 12 }}>{t("risk.shortHistory", { symbol: r.window_limited_by, days: r.days })}</div>
      )}

      {!!r?.breaches.length && (
        <div className="card" style={{ marginBottom: 16, borderColor: "color-mix(in srgb, var(--down) 40%, var(--line))" }}>
          <h2 style={{ color: "var(--down)" }}>{t("risk.breaches")}</h2>
          {r.breaches.map((b) => <div key={b.rule + b.subject}>⚠ {b.message}</div>)}
        </div>
      )}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card stat">
            <div className="label">{t(label)}</div>
            <div className="value" style={{ fontSize: 20 }}>{value}</div>
            {sub && <div className="delta sub" style={{ fontSize: 12 }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>{t("risk.sectors")}</h2>
          {sectors.length > 0 && r && (
            <div style={{ height: Math.max(160, sectors.length * 32) }}>
              <ResponsiveContainer>
                <BarChart data={sectors} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <XAxis type="number" stroke="#8b909a" fontSize={11} tickFormatter={(x) => `${x}%`} />
                  <YAxis type="category" dataKey="name" stroke="#8b909a" fontSize={12} width={120} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} formatter={(x: number) => `${x}%`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <ReferenceLine x={r.rules.max_sector_pct} stroke="#ec6650" strokeDasharray="4 3" label={{ value: t("risk.chartLimit"), fill: "#ec6650", fontSize: 11, position: "top" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sectors.map((x) => <Cell key={x.name} fill={x.value > r.rules.max_sector_pct ? "#ec6650" : "#e8b04a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card">
          <h2>{t("risk.correlationTitle")}</h2>
          {r && r.correlation.symbols.length > 1 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "auto" }}>
                <thead><tr><th />{r.correlation.symbols.map((x) => <th key={x} className="n">{x}</th>)}</tr></thead>
                <tbody>
                  {r.correlation.matrix.map((row, i) => (
                    <tr key={r.correlation.symbols[i]}>
                      <td className="sym">{r.correlation.symbols[i]}</td>
                      {row.map((c, j) => (
                        <td key={j} className="n" style={{ background: corrColor(c), minWidth: 52 }}><bdi>{c == null ? "—" : c.toFixed(2)}</bdi></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sub" style={{ fontSize: 12, marginTop: 6 }}>{t("risk.correlationLegend")}</div>
            </div>
          ) : <div className="empty">{t("risk.correlationNeedsTwo")}</div>}
        </div>
      </div>

      <div className="card">
        <h2>{t("risk.stressTitle")}</h2>
        {s && (
          <>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={stress} margin={{ bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#8b909a" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#8b909a" fontSize={11} tickFormatter={(x) => `${x}%`} />
                  <Tooltip contentStyle={TT} formatter={(x: number) => `${x}%`} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <ReferenceLine y={s.loss_limit_pct} stroke="#ec6650" strokeDasharray="4 3" label={{ value: t("risk.yourLimit", { pct: share(s.loss_limit_pct) }), fill: "#ec6650", fontSize: 11, position: "insideBottomRight" }} />
                  <Bar dataKey="value" radius={[0, 0, 4, 4]}>
                    {stress.map((x) => <Cell key={x.name} fill={x.breach ? "#ec6650" : "#3a404a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="scroll-x">
              <table>
                <thead><tr><th>{t("risk.scenario")}</th><th className="n">{t("risk.portfolioChange")}</th><th>{t("risk.biggestHits")}</th></tr></thead>
                <tbody>
                  {s.scenarios.map((x) => (
                    <tr key={x.key}>
                      <td>{x.name} <span className="sub" style={{ fontSize: 11 }}>{x.kind in KIND ? t(KIND[x.kind as keyof typeof KIND]) : x.kind}</span></td>
                      <td className={`n ${x.breaches_limit ? "down" : ""}`}>{money(x.change)} ({pct(x.change_pct)}){x.breaches_limit && " ⚠"}</td>
                      <td className="sub" style={{ fontSize: 12 }}>{x.worst.map((w) => ltr(`${w.symbol} ${pct(w.change_pct)}${w.basis !== "actual fall" ? "*" : ""}`)).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sub" style={{ fontSize: 12, marginTop: 6 }}>{t("risk.stressFootnote")} {s.note}{isSampleData(s.data_source) ? ` ${t("risk.sampleData")}` : ""}</div>
          </>
        )}
      </div>
    </>
  );
}
