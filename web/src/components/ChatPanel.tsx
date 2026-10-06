"use client";

import { useEffect, useRef, useState } from "react";
import { api, ChatMsg, ModelChoice } from "@/lib/api";
import { useApi } from "@/lib/useApi";

export default function ChatPanel({ symbol, height = 520, suggestions = [] }: { symbol?: string; height?: number; suggestions?: string[] }) {
  const { data: models } = useApi<ModelChoice[]>("/ai/models");
  const [model, setModel] = useState("auto");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ model: string; content: string; tools_used: string[] }>("/ai/chat", {
        method: "POST",
        json: { model, symbol, messages: next.map(({ role, content }) => ({ role, content })) },
      });
      const meta = `${r.model}${r.tools_used.length ? " · " + [...new Set(r.tools_used)].join(", ") : ""}`;
      setMsgs([...next, { role: "assistant", content: r.content, meta }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const noKeys = models && !models.some((m) => m.available);

  return (
    <div className="card chat">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{symbol ? `Ask about ${symbol}` : "AI analyst"}</h2>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={{ maxWidth: 240, flex: 0 }}>
          {models?.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.available && m.id !== "external"}>
              {m.label}{!m.available && m.id !== "external" ? " (no key)" : ""}
            </option>
          ))}
        </select>
      </div>
      {noKeys && <div className="sub" style={{ fontSize: 12 }}>No AI keys yet. Add your own in Settings, or set server keys on Render.</div>}
      <div className="msgs" style={{ height }}>
        {!msgs.length && (
          <div className="empty">
            <div style={{ marginBottom: 10 }}>The agent can read your portfolio, targets, watchlist, ratios and news.</div>
            <div className="seg" style={{ justifyContent: "center" }}>
              {suggestions.map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
            {m.meta && <span className="meta">{m.meta}</span>}
          </div>
        ))}
        {busy && <div className="msg assistant sub">Thinking…</div>}
        <div ref={end} />
      </div>
      {err && <div className="err">{err}</div>}
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your investments…" />
        <button className="btn primary" disabled={busy || !input.trim()}>Send</button>
      </form>
      <div className="sub" style={{ fontSize: 11 }}>Information, not financial advice.</div>
    </div>
  );
}
