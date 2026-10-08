"use client";

import Link from "next/link";
import AlertsBell from "@/components/AlertsBell";
import AllocationPie from "@/components/AllocationPie";
import BookToggle, { PaperNotice } from "@/components/BookToggle";
import NewsFeed from "@/components/NewsFeed";
import SymbolSearch from "@/components/SymbolSearch";
import ValueChart from "@/components/ValueChart";
import { Evaluation, Portfolio, RiskProfile } from "@/lib/api";
import { money, pct, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { useBookMode } from "@/lib/useBookMode";

export default function Dashboard() {
  const [mode, setMode] = useBookMode();
  const { data: p, error } = useApi<Portfolio>(`/portfolio?mode=${mode}`);
  const { data: evals } = useApi<Evaluation[]>("/targets/evaluate");
  const { data: profile } = useApi<RiskProfile>("/safety/profile");
  const t = p?.totals;

  return (
    <>
      <div className="topbar">
        <h1>Dashboard</h1>
        <div className="row" style={{ flex: "0 1 auto" }}>
          <BookToggle mode={mode} onChange={setMode} />
          <SymbolSearch />
          <AlertsBell />
        </div>
      </div>

      {profile && !profile.saved && (
        <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderColor: "color-mix(in srgb, var(--accent) 45%, var(--line))" }}>
          <div>
            <b>Set your risk profile first.</b>{" "}
            <span className="sub">Five questions set the rules every safety check, buy plan and the AI agent will follow.</span>
          </div>
          <Link href="/risk-profile" className="btn primary">Start</Link>
        </div>
      )}
      {mode === "paper" && <PaperNotice />}
      {!!t?.unpriced.length && (
        <div className="err" style={{ marginBottom: 16 }}>No live price for {t.unpriced.join(", ")}: valued at what you paid, so totals and P/L are incomplete.</div>
      )}
      {error && <div className="err" style={{ marginBottom: 16 }}>Can&apos;t reach the API: {error}. Check Settings → API URL.</div>}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Net worth" value={money(t?.net_worth)} />
        <Stat label="Total P/L" value={money(t?.pnl)} delta={pct(t?.pnl_pct)} d={t?.pnl} />
        <Stat label="Today" value={money(t?.day_change)} d={t?.day_change} />
        <Stat label="Cash" value={money(t?.cash)} />
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="span2"><ValueChart mode={mode} /></div>
        <div className="card">
          <h2>Allocation</h2>
          {p && <AllocationPie holdings={p.holdings} cash={p.totals.cash} />}
        </div>
      </div>

      <div className="grid g3">
        <div className="card span2">
          <h2>Holdings</h2>
          {p && !p.holdings.length ? (
            <div className="empty">No holdings yet. <Link href="/portfolio" style={{ color: "var(--accent)" }}>Add one →</Link></div>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr><th>Symbol</th><th className="n">Price</th><th className="n">Day</th><th className="n">Value</th><th className="n">P/L</th><th className="n">Weight</th></tr>
                </thead>
                <tbody>
                  {p?.holdings.map((h) => (
                    <tr key={h.id}>
                      <td><Link href={`/stock?s=${h.symbol}`} className="sym">{h.symbol}</Link></td>
                      <td className="n">{money(h.price)}</td>
                      <td className={`n ${tone(h.day_change_pct)}`}>{pct(h.day_change_pct)}</td>
                      <td className="n">{money(h.value)}</td>
                      <td className={`n ${tone(h.pnl)}`}>{money(h.pnl)} <span className="sub">{pct(h.pnl_pct)}</span></td>
                      <td className="n">{h.weight_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Targets</h2>
          {mode === "paper" && <div className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Targets track real money only.</div>}
          {!evals?.length && <div className="empty"><Link href="/targets" style={{ color: "var(--accent)" }}>Set a PAPI target →</Link></div>}
          {evals?.map((e) => (
            <Link key={e.target_id} href="/targets" style={{ display: "block", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{e.name} <span className="sub">{e.symbol ?? "portfolio"}</span></span>
                <span className={`chip ${e.breaches.length ? "above_max" : "ok"}`}>{e.breaches.length ? `${e.breaches.length} breach` : "in range"}</span>
              </div>
              {e.checks.profit.progress_pct != null && (
                <div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${Math.max(0, Math.min(100, e.checks.profit.progress_pct))}%` }} /></div>
              )}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16 }}><NewsFeed /></div>
    </>
  );
}

function Stat({ label, value, delta, d }: { label: string; value: string; delta?: string; d?: number }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${d !== undefined ? tone(d) : ""}`}>{value}</div>
      {delta && <div className={`delta ${tone(d)}`}>{delta}</div>}
    </div>
  );
}
