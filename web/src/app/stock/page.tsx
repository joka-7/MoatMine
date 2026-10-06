"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import PriceChart from "@/components/PriceChart";
import RatiosPanel from "@/components/RatiosPanel";
import SymbolSearch from "@/components/SymbolSearch";
import { api, NewsItem, Note, Quote } from "@/lib/api";
import { date, money, pct, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";

// Query-param route (/stock?s=AAPL) so it works in the static desktop export too.
export default function StockPage() {
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
      <Stock />
    </Suspense>
  );
}

function Stock() {
  const symbol = (useSearchParams().get("s") || "AAPL").toUpperCase();
  const { data: q } = useApi<Quote>(`/stocks/${symbol}/quote`);
  const { data: prof } = useApi<{ name: string; industry: string; exchange: string; market_cap: number | null }>(`/stocks/${symbol}/profile`);
  const [msg, setMsg] = useState<string | null>(null);

  const watch = async () => {
    try { await api("/watchlist", { method: "POST", json: { symbol } }); setMsg("Added to watchlist"); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1><span className="sym">{symbol}</span> <span className="sub" style={{ fontWeight: 400 }}>{prof?.name}</span></h1>
          <div className="sub" style={{ fontSize: 12 }}>
            {[prof?.exchange, prof?.industry, prof?.market_cap ? `Mkt cap ${money(prof.market_cap * 1e6).replace(/\.\d+$/, "")}` : null].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="row" style={{ flex: 0, alignItems: "center" }}>
          <div style={{ textAlign: "right", minWidth: 140 }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{money(q?.price)}</div>
            <div className={`num ${tone(q?.change)}`}>{q ? `${q.change > 0 ? "+" : ""}${q.change.toFixed(2)} (${pct(q.change_pct)})` : ""}</div>
          </div>
          <button className="btn" onClick={watch}>＋ Watch</button>
          <SymbolSearch />
        </div>
      </div>
      {msg && <div className="sub" style={{ marginBottom: 10 }}>{msg}</div>}

      <div style={{ marginBottom: 16 }}><PriceChart symbol={symbol} /></div>
      <div style={{ marginBottom: 16 }}><RatiosPanel symbol={symbol} /></div>

      <div className="grid g3">
        <News symbol={symbol} />
        <Notes symbol={symbol} />
        <ChatPanel symbol={symbol} height={300} suggestions={[`Summarise ${symbol}'s valuation`, `How does ${symbol} fit my targets?`]} />
      </div>
    </>
  );
}

function News({ symbol }: { symbol: string }) {
  const [days, setDays] = useState(14);
  const { data } = useApi<NewsItem[]>(`/stocks/${symbol}/news?days=${days}`);
  return (
    <div className="card news">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>News</h2>
        <select value={days} onChange={(e) => setDays(+e.target.value)} style={{ flex: 0, minWidth: 90 }}>
          {[3, 7, 14, 30, 90].map((d) => <option key={d} value={d}>{d}d</option>)}
        </select>
      </div>
      <ul style={{ maxHeight: 360, overflowY: "auto" }}>
        {data?.map((n, i) => (
          <li key={i}>
            <a href={n.url || undefined} target="_blank" rel="noreferrer">
              <div className="h">{n.headline}</div>
              <div className="sub" style={{ fontSize: 12 }}>{n.source} · {date(n.datetime)}</div>
            </a>
          </li>
        ))}
      </ul>
      {data && !data.length && <div className="empty">No recent news.</div>}
    </div>
  );
}

function Notes({ symbol }: { symbol: string }) {
  const { data, reload } = useApi<Note[]>(`/stocks/${symbol}/notes`);
  const [f, setF] = useState({ kind: "note", title: "", body: "", url: "" });
  return (
    <div className="card">
      <h2>My info</h2>
      <form className="grid" style={{ gap: 8, marginBottom: 10 }} onSubmit={async (e) => {
        e.preventDefault();
        await api(`/stocks/${symbol}/notes`, { method: "POST", json: f });
        setF({ ...f, title: "", body: "", url: "" });
        reload();
      }}>
        <div className="row">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={{ maxWidth: 110 }}>
            <option value="note">Note</option><option value="thesis">Thesis</option><option value="news">News</option><option value="link">Link</option>
          </select>
          <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <textarea rows={3} placeholder="Details…" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        {(f.kind === "link" || f.kind === "news") && <input placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />}
        <button className="btn primary">Save</button>
      </form>
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {data?.map((n) => (
          <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span><span className="chip">{n.kind}</span> {n.url ? <a href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{n.title}</a> : n.title}</span>
              <button className="btn sm ghost" onClick={async () => { await api(`/stocks/${symbol}/notes/${n.id}`, { method: "DELETE" }); reload(); }}>×</button>
            </div>
            {n.body && <div className="sub" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{n.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
