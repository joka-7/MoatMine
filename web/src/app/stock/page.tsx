"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import PriceChart from "@/components/PriceChart";
import RatiosPanel from "@/components/RatiosPanel";
import SymbolSearch from "@/components/SymbolSearch";
import { AnalystsPanel, CompanyCard, DividendsPanel, EarningsPanel, NewsPanel } from "@/components/ResearchPanels";
import BadTimesPanel from "@/components/BadTimesPanel";
import SafetyPanel from "@/components/SafetyPanel";
import ValuationPanel from "@/components/ValuationPanel";
import { Note, Quote } from "@/lib/api";
import { addNote, listNotes, removeNote } from "@/lib/data/notes";
import { addWatch } from "@/lib/data/watchlist";
import { money, pct, tone } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { useLoader } from "@/lib/useLoader";
import { useLocalMode } from "@/lib/localMode";

// Query-param route (/stock?s=AAPL) so it works in the static desktop export too.
export default function StockPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="empty">{t("common.loading")}</div>}>
      <Stock />
    </Suspense>
  );
}

const TABS = [
  ["overview", "stock.tab.overview"], ["safety", "stock.tab.safety"], ["valuation", "stock.tab.valuation"], ["badtimes", "stock.tab.badtimes"],
  ["financials", "stock.tab.financials"], ["analysts", "stock.tab.analysts"], ["news", "stock.tab.news"], ["notes", "stock.tab.notes"], ["ai", "stock.tab.ai"],
] as const satisfies readonly (readonly [string, MessageKey])[];

const ASK_AI: readonly MessageKey[] = [
  "stock.ask.rules", "stock.ask.undervalued", "stock.ask.crises", "stock.ask.earnings", "stock.ask.analysts", "stock.ask.targets",
];

const NOTE_KIND: Record<string, MessageKey> = {
  note: "stock.notes.kind.note", thesis: "stock.notes.kind.thesis", news: "stock.notes.kind.news", link: "stock.notes.kind.link",
};
type Tab = (typeof TABS)[number][0];

function Stock() {
  const { t } = useI18n();
  const params = useSearchParams();
  const symbol = (params.get("s") || "AAPL").toUpperCase();
  const [tab, setTabState] = useState<Tab>((TABS.find(([k]) => k === params.get("tab"))?.[0] ?? "overview") as Tab);
  const setTab = (next: Tab) => {
    setTabState(next);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", next);
    window.history.replaceState(null, "", u);
  };
  const { data: q } = useApi<Quote>(`/stocks/${symbol}/quote`);
  const { data: prof } = useApi<{ name: string; industry: string; exchange: string; market_cap: number | null }>(`/stocks/${symbol}/profile`);
  const [msg, setMsg] = useState<string | null>(null);

  const watch = async () => {
    try { await addWatch({ symbol, note: "", alert_above: null, alert_below: null }); setMsg(t("stock.watchAdded")); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1><span className="sym">{symbol}</span> <span className="sub" style={{ fontWeight: 400 }}>{prof?.name}</span></h1>
          <div className="sub" style={{ fontSize: 12 }}>
            {[prof?.exchange, prof?.industry, prof?.market_cap ? t("stock.mktCap", { cap: money(prof.market_cap * 1e6, "USD", 0) }) : null].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="row" style={{ flex: "0 1 auto", alignItems: "center" }}>
          <div style={{ textAlign: "end", minWidth: 140 }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{money(q?.price)}</div>
            <div className={`num ${tone(q?.change)}`}>{q ? `${q.change > 0 ? "+" : ""}${q.change.toFixed(2)} (${pct(q.change_pct)})` : ""}</div>
          </div>
          <button className="btn" onClick={watch}>{t("stock.watch")}</button>
          <SymbolSearch />
        </div>
      </div>
      {msg && <div className="sub" style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="seg" style={{ marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`btn ${tab === k ? "on" : "ghost"}`} onClick={() => setTab(k)}>{t(label)}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid" style={{ gap: 16 }}>
          <PriceChart symbol={symbol} />
          <CompanyCard symbol={symbol} />
          <RatiosPanel symbol={symbol} />
        </div>
      )}
      {tab === "safety" && <SafetyPanel symbol={symbol} />}
      {tab === "valuation" && <ValuationPanel symbol={symbol} />}
      {tab === "badtimes" && <BadTimesPanel symbol={symbol} />}
      {tab === "financials" && (
        <div className="grid g2"><EarningsPanel symbol={symbol} /><DividendsPanel symbol={symbol} /></div>
      )}
      {tab === "analysts" && <AnalystsPanel symbol={symbol} />}
      {tab === "news" && <NewsPanel symbol={symbol} />}
      {tab === "notes" && <div style={{ maxWidth: 720 }}><Notes symbol={symbol} /></div>}
      {tab === "ai" && (
        <ChatPanel symbol={symbol} height={460} suggestions={ASK_AI.map((k) => t(k, { symbol }))} />
      )}
    </>
  );
}

function Notes({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const kindLabel = (kind: string) => {
    const key = NOTE_KIND[kind];
    return key ? t(key) : kind;
  };
  const { on: local, ready } = useLocalMode();
  const { data, reload } = useLoader<Note[]>(ready ? () => listNotes(symbol, local) : null, `notes:${symbol}:${local}`);
  const [f, setF] = useState({ kind: "note", title: "", body: "", url: "" });
  return (
    <div className="card">
      <h2>{t("stock.notes.title")}</h2>
      <form className="grid" style={{ gap: 8, marginBottom: 10 }} onSubmit={async (e) => {
        e.preventDefault();
        await addNote(symbol, f);
        setF({ ...f, title: "", body: "", url: "" });
        reload();
      }}>
        <div className="row">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={{ maxWidth: 110 }}>
            {Object.entries(NOTE_KIND).map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}
          </select>
          <input required placeholder={t("stock.notes.titlePlaceholder")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <textarea rows={3} placeholder={t("stock.notes.bodyPlaceholder")} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        {(f.kind === "link" || f.kind === "news") && <input placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />}
        <button className="btn primary">{t("common.save")}</button>
      </form>
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {data?.map((n) => (
          <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span><span className="chip">{kindLabel(n.kind)}</span> {n.url ? <a href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{n.title}</a> : n.title}</span>
              <button className="btn sm ghost" onClick={async () => { await removeNote(symbol, n.id); reload(); }}>×</button>
            </div>
            {n.body && <div className="sub" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{n.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
