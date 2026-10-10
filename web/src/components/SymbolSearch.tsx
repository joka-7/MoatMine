"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function SymbolSearch({ onPick, placeholder }: { onPick?: (s: string) => void; placeholder?: string }) {
  const { t } = useI18n();
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
        placeholder={placeholder ?? t("dashboard.search.placeholder")}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && q.trim() && pick(q.trim().toUpperCase())}
      />
      {hits.length > 0 && (
        <div className="card" style={{ position: "absolute", top: 40, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 30, padding: 6 }}>
          {hits.slice(0, 8).map((h) => (
            <button key={h.symbol} className="btn ghost" style={{ display: "flex", width: "100%", border: 0, gap: 10, textAlign: "start" }} onClick={() => pick(h.symbol)}>
              <span className="sym">{h.symbol}</span>
              <span className="sub" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
