"use client";

import { AskExternallyButton, ConversationIntro, NoProviderPrompt, PasteExternalReply } from "modeldispatcher-react-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AiSettings, api, ApiError, ChatMsg, DispatcherErrorBody, ModelChoice } from "@/lib/api";
import { useApi } from "@/lib/useApi";

/** Errors ModelDispatcher wants the user to act on: open AI settings / the key wizard. */
function needsKeys(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  const body = e.body as DispatcherErrorBody | undefined;
  return body?.action === "trigger_key_wizard" || body?.action === "open_ai_settings" || body?.error === "quota_exceeded";
}

export default function ChatPanel({ symbol, height = 520, suggestions = [] }: { symbol?: string; height?: number; suggestions?: string[] }) {
  const router = useRouter();
  const { data: models } = useApi<ModelChoice[]>("/ai/models");
  const { data: settings } = useApi<AiSettings>("/ai/settings");
  const [model, setModel] = useState("auto");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [keyWizard, setKeyWizard] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, busy]);

  const favorite = settings?.favorite ?? null;
  const noProvider = models !== null && !models.some((m) => m.available);
  const lastQuestion = input.trim() || [...msgs].reverse().find((m) => m.role === "user")?.content || "";
  const externalQuestion = lastQuestion && symbol ? `About the stock ${symbol}: ${lastQuestion}` : lastQuestion;

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setErr(null);
    setKeyWizard(false);
    try {
      const r = await api<{ model: string; content: string; tools_used: string[] }>("/ai/chat", {
        method: "POST",
        json: { model, symbol, messages: next.map(({ role, content }) => ({ role, content })) },
      });
      const meta = `${r.model}${r.tools_used.length ? " · " + [...new Set(r.tools_used)].join(", ") : ""}`;
      setMsgs([...next, { role: "assistant", content: r.content, meta }]);
    } catch (e) {
      setErr((e as Error).message);
      setKeyWizard(needsKeys(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card chat">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{symbol ? `Ask about ${symbol}` : "AI analyst"}</h2>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={{ maxWidth: 280, flex: "0 1 auto" }} aria-label="Model">
          {models?.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.available}>{m.label}{!m.available ? " (not set up)" : ""}</option>
          ))}
        </select>
      </div>

      {noProvider ? (
        <NoProviderPrompt favorite={favorite} question={externalQuestion} onOpenSettings={() => router.push("/settings")} />
      ) : (
        <>
          <ConversationIntro />
          <div className="msgs" style={{ height }}>
            {!msgs.length && (
              <div className="empty">
                <div style={{ marginBottom: 10 }}>The agent reads your portfolio, risk rules, safety scores, valuations and news.</div>
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
        </>
      )}

      {err && (
        <div className="err">
          {err}
          {keyWizard && <> · <Link href="/settings" style={{ textDecoration: "underline" }}>Add your own AI key</Link></>}
        </div>
      )}

      {!noProvider && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your investments…" aria-label="Message" />
          <button className="btn primary" disabled={busy || !input.trim()}>Send</button>
        </form>
      )}

      {favorite && (
        <div className="grid" style={{ gap: 8 }}>
          <AskExternallyButton favorite={favorite} question={externalQuestion} />
          <PasteExternalReply
            label="Asked it outside the app? Paste the reply to keep it here."
            onApply={(raw) => setMsgs((m) => [...m, { role: "assistant", content: raw, meta: `pasted from ${favorite}` }])}
          />
        </div>
      )}
      <div className="sub" style={{ fontSize: 11 }}>Information, not financial advice.</div>
    </div>
  );
}
