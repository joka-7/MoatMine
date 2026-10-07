"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import PriceChart from "@/components/PriceChart";
import RatiosPanel from "@/components/RatiosPanel";
import SymbolSearch from "@/components/SymbolSearch";
import { AnalystsPanel, CompanyCard, DividendsPanel, EarningsPanel, NewsPanel } from "@/components/ResearchPanels";
import BadTimesPanel from "@/components/BadTimesPanel";
import ValuationPanel from "@/components/ValuationPanel";
import { api, Note, Quote } from "@/lib/api";
import { money, pct, tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";

// Query-param route (/stock?s=AAPL) so it works in the static desktop export too.
export default function StockPage() {
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
      <Stock />
    </Suspense>
  );
}

const TABS = [
  ["overview", "Overview"], ["valuation", "Valuation"], ["badtimes", "Bad times"], ["financials", "Earnings & dividends"],
  ["analysts", "Analysts"], ["news", "News"], ["notes", "My info"], ["ai", "Ask AI"],
] as const;
type Tab = (typeof TABS)[number][0];

function Stock() {
  const params = useSearchParams();
  const symbol = (params.get("s") || "AAPL").toUpperCase();
  const [tab, setTabState] = useState<Tab>((TABS.find(([k]) => k === params.get("tab"))?.[0] ?? "overview") as Tab);
  const setTab = (t: Tab) => {
    setTabState(t);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", t);
    window.history.replaceState(null, "", u);
  };
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

      <div className="seg" style={{ marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`btn ${tab === k ? "on" : "ghost"}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid" style={{ gap: 16 }}>
          <PriceChart symbol={symbol} />
          <CompanyCard symbol={symbol} />
          <RatiosPanel symbol={symbol} />
        </div>
      )}
      {tab === "valuation" && <ValuationPanel symbol={symbol} />}
      {tab === "badtimes" && <BadTimesPanel symbol={symbol} />}
      {tab === "financials" && (
        <div className="grid g2"><EarningsPanel symbol={symbol} /><DividendsPanel symbol={symbol} /></div>
      )}
      {tab === "analysts" && <AnalystsPanel symbol={symbol} />}
      {tab === "news" && <NewsPanel symbol={symbol} />}
      {tab === "notes" && <div style={{ maxWidth: 720 }}><Notes symbol={symbol} /></div>}
      {tab === "ai" && (
        <ChatPanel symbol={symbol} height={460} suggestions={[
          `Is ${symbol} undervalued? Show the models`, `How did ${symbol} do in past crises?`, `Summarise ${symbol}'s last earnings`,
          `What do analysts think of ${symbol}?`, `How does ${symbol} fit my targets?`,
        ]} />
      )}
    </>
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
