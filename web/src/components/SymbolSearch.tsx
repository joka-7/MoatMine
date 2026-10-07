"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SymbolSearch({ onPick, placeholder = "Search symbol…" }: { onPick?: (s: string) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ symbol: string; name: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 1) return setHits([]);
    const t = setTimeout(() => {
      api<{ symbol: string; name: string }[]>(`/stocks/search?q=${encodeURIComponent(q)}`).then(setHits).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (s: string) => {
    setQ("");
    setHits([]);
    if (onPick) onPick(s);
    else router.push(`/stock?s=${encodeURIComponent(s)}`);
  };

  return (
    <div style={{ position: "relative", minWidth: "min(220px, 100%)" }}>
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && q.trim() && pick(q.trim().toUpperCase())}
      />
      {hits.length > 0 && (
        <div className="card" style={{ position: "absolute", top: 40, left: 0, right: 0, zIndex: 30, padding: 6 }}>
          {hits.slice(0, 8).map((h) => (
            <button key={h.symbol} className="btn ghost" style={{ display: "flex", width: "100%", border: 0, gap: 10, textAlign: "left" }} onClick={() => pick(h.symbol)}>
              <span className="sym">{h.symbol}</span>
              <span className="sub" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
