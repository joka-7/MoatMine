"use client";

import Link from "next/link";
import { useState } from "react";
import SymbolSearch from "@/components/SymbolSearch";
import { api, WatchRow } from "@/lib/api";
import { money, pct, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";

export default function WatchlistPage() {
  const { data, reload } = useApi<WatchRow[]>("/watchlist");
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "", note: "", alert_above: "", alert_below: "" });

  const run = async (fn: () => Promise<unknown>) => {
    try { setErr(null); await fn(); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  const n = (s: string) => (s === "" ? null : +s);

  return (
    <>
      <div className="topbar"><h1>Watchlist</h1></div>
      {err && <div className="err" style={{ marginBottom: 16 }}>{err}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Watch a stock</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => {
          await api("/watchlist", { method: "POST", json: { symbol: form.symbol, note: form.note, alert_above: n(form.alert_above), alert_below: n(form.alert_below) } });
          setForm({ symbol: "", note: "", alert_above: "", alert_below: "" });
        }); }}>
          <label className="f">Symbol {form.symbol && <b className="sym" style={{ color: "var(--accent)" }}>{form.symbol}</b>}
            <SymbolSearch placeholder="TSLA" onPick={(s) => setForm({ ...form, symbol: s })} />
          </label>
          <label className="f">Why<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="waiting for pullback" /></label>
          <label className="f">Alert above<input type="number" step="any" value={form.alert_above} onChange={(e) => setForm({ ...form, alert_above: e.target.value })} /></label>
          <label className="f">Alert below<input type="number" step="any" value={form.alert_below} onChange={(e) => setForm({ ...form, alert_below: e.target.value })} /></label>
          <button className="btn primary" disabled={!form.symbol}>Add</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Symbol</th><th className="n">Price</th><th className="n">Day</th><th className="n">Above</th><th className="n">Below</th><th>Note</th><th /></tr></thead>
          <tbody>
            {data?.map((w) => {
              const hit = w.quote && ((w.alert_above != null && w.quote.price >= w.alert_above) || (w.alert_below != null && w.quote.price <= w.alert_below));
              return (
                <tr key={w.id}>
                  <td><Link className="sym" href={`/stock?s=${w.symbol}`}>{w.symbol}</Link> {hit && <span className="chip above_max">triggered</span>}</td>
                  <td className="n">{money(w.quote?.price)}</td>
                  <td className={`n ${tone(w.quote?.change_pct)}`}>{pct(w.quote?.change_pct)}</td>
                  <td className="n">{w.alert_above ?? "—"}</td>
                  <td className="n">{w.alert_below ?? "—"}</td>
                  <td className="sub">{w.note}</td>
                  <td style={{ textAlign: "right" }}><button className="btn sm" onClick={() => run(() => api(`/watchlist/${w.id}`, { method: "DELETE" }))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && !data.length && <div className="empty">Nothing watched yet.</div>}
      </div>
    </>
  );
}
