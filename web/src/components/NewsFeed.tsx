"use client";

import Link from "next/link";
import { useState } from "react";
import { FeedItem } from "@/lib/api";
import { date } from "@/lib/format";
import { useApi } from "@/lib/useApi";

export default function NewsFeed() {
  const [days, setDays] = useState(7);
  const [scope, setScope] = useState<"all" | "held" | "watched">("all");
  const { data } = useApi<FeedItem[]>(`/news/feed?days=${days}`);
  const items = (data ?? []).filter((n) => scope === "all" || (scope === "held" ? n.held : !n.held));

  return (
    <div className="card news">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>News on your stocks</h2>
        <div className="seg" style={{ flex: "0 1 auto" }}>
          {(["all", "held", "watched"] as const).map((s) => (
            <button key={s} className={`btn sm ${scope === s ? "on" : ""}`} onClick={() => setScope(s)}>
              {s === "all" ? "All" : s === "held" ? "Holdings" : "Watchlist"}
            </button>
          ))}
          <select value={days} onChange={(e) => setDays(+e.target.value)} style={{ width: 70 }}>
            {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d}d</option>)}
          </select>
        </div>
      </div>
      <ul style={{ maxHeight: 420, overflowY: "auto" }}>
        {items.map((n, i) => (
          <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <Link href={`/stock?s=${n.symbol}&tab=news`} className="sym" style={{ minWidth: 56, color: n.held ? "var(--accent)" : "var(--muted)" }}>{n.symbol}</Link>
            <a href={n.url || undefined} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
              <div className="h">{n.headline}</div>
              <div className="sub" style={{ fontSize: 12 }}>{n.source} · {date(n.datetime)}</div>
            </a>
          </li>
        ))}
      </ul>
      {data && !items.length && <div className="empty">No news. Add holdings or watchlist symbols.</div>}
    </div>
  );
}
