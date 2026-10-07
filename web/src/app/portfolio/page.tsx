"use client";

import Link from "next/link";
import { useState } from "react";
import SymbolSearch from "@/components/SymbolSearch";
import { CheckView } from "@/components/SafetyBits";
import { api, CheckResult, Portfolio } from "@/lib/api";
import { date, money, pct, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";

export default function PortfolioPage() {
  const { data: p, reload, error } = useApi<Portfolio>("/portfolio");
  const [err, setErr] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);
  const [acc, setAcc] = useState({ name: "", broker: "manual", currency: "USD", cash: "" });
  const [h, setH] = useState({ account_id: "", symbol: "", quantity: "", avg_cost: "", opened_at: "" });

  const run = async (fn: () => Promise<unknown>) => {
    try { setErr(null); await fn(); await reload(); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <div className="topbar"><h1>Portfolio</h1></div>
      {(err || error) && <div className="err" style={{ marginBottom: 16 }}>{err || error}</div>}

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Accounts</h2>
          <table>
            <thead><tr><th>Name</th><th>Broker</th><th className="n">Cash</th><th /></tr></thead>
            <tbody>
              {p?.accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td><td className="sub">{a.broker}</td><td className="n">{money(a.cash, a.currency)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm" onClick={() => confirm(`Delete ${a.name} and its holdings?`) && run(() => api(`/accounts/${a.id}`, { method: "DELETE" }))}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/accounts", { method: "POST", json: { ...acc, cash: +acc.cash || 0 } }); setAcc({ ...acc, name: "", cash: "" }); }); }}>
            <label className="f">Name<input required value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} placeholder="e.g. IBKR" /></label>
            <label className="f">Type
              <select value={acc.broker === "paper" ? "paper" : "manual"} onChange={(e) => setAcc({ ...acc, broker: e.target.value })}>
                <option value="manual">Real (manual)</option>
                <option value="paper">Paper (practice)</option>
              </select>
            </label>
            <label className="f">Cash<input type="number" step="any" value={acc.cash} onChange={(e) => setAcc({ ...acc, cash: e.target.value })} /></label>
            <button className="btn primary">Add account</button>
          </form>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>Manual for now. Broker sync (SnapTrade / Plaid) plugs into the same tables.</div>
        </div>

        <div className="card">
          <h2>Add holding</h2>
          <form className="grid" onSubmit={(e) => { e.preventDefault(); run(async () => {
            const out = await api<{ id: number; check: CheckResult }>("/holdings", { method: "POST", json: {
              account_id: +h.account_id, symbol: h.symbol, quantity: +h.quantity, avg_cost: +h.avg_cost,
              ...(h.opened_at ? { opened_at: new Date(h.opened_at).toISOString() } : {}),
            } });
            setLastCheck(out.check);
            setH({ ...h, symbol: "", quantity: "", avg_cost: "" });
          }); }}>
            <div className="row">
              <label className="f">Account
                <select required value={h.account_id} onChange={(e) => setH({ ...h, account_id: e.target.value })}>
                  <option value="">—</option>
                  {p?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="f">Symbol {h.symbol && <b className="sym" style={{ color: "var(--accent)" }}>{h.symbol}</b>}
                <SymbolSearch placeholder="AAPL" onPick={(s) => setH({ ...h, symbol: s })} />
              </label>
            </div>
            <div className="row">
              <label className="f">Quantity<input required type="number" step="any" min="0" value={h.quantity} onChange={(e) => setH({ ...h, quantity: e.target.value })} /></label>
              <label className="f">Avg cost<input required type="number" step="any" min="0" value={h.avg_cost} onChange={(e) => setH({ ...h, avg_cost: e.target.value })} /></label>
              <label className="f">Opened<input type="date" value={h.opened_at} onChange={(e) => setH({ ...h, opened_at: e.target.value })} /></label>
            </div>
            <button className="btn primary" disabled={!h.symbol || !h.account_id}>Add holding</button>
          </form>
          <div className="sub" style={{ fontSize: 12, marginTop: 8 }}>
            Recording a buy you already made. To decide on a new buy first, use the stock&apos;s Safety tab → Check a buy.
            Paper accounts refuse buys your rules block.
          </div>
          {lastCheck && lastCheck.verdict !== "pass" && (
            <div className="card" style={{ marginTop: 10, background: "var(--bg)" }}>
              <div className="sub" style={{ fontSize: 12, marginBottom: 6 }}>Added — but note your risk rules:</div>
              <CheckView check={lastCheck} />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Positions</h2>
        <table>
          <thead>
            <tr><th>Symbol</th><th>Account</th><th className="n">Qty</th><th className="n">Avg cost</th><th className="n">Price</th><th className="n">Value</th><th className="n">P/L</th><th>Opened</th><th /></tr>
          </thead>
          <tbody>
            {p?.holdings.map((r) => (
              <tr key={r.id}>
                <td><Link className="sym" href={`/stock?s=${r.symbol}`}>{r.symbol}</Link></td>
                <td className="sub">{p.accounts.find((a) => a.id === r.account_id)?.name}</td>
                <td className="n">{r.quantity}</td>
                <td className="n">{money(r.avg_cost)}</td>
                <td className="n">{money(r.price)}</td>
                <td className="n">{money(r.value)}</td>
                <td className={`n ${tone(r.pnl)}`}>{money(r.pnl)} <span className="sub">{pct(r.pnl_pct)}</span></td>
                <td className="sub">{date(r.opened_at)}</td>
                <td style={{ textAlign: "right" }}><button className="btn sm" onClick={() => run(() => api(`/holdings/${r.id}`, { method: "DELETE" }))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {p && !p.holdings.length && <div className="empty">No positions.</div>}
      </div>
    </>
  );
}
