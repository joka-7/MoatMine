"use client";

import { NoProviderConfiguredError } from "modeldispatcher-browser-agent";
import { AskExternallyButton, ConversationIntro, NoProviderPrompt, PasteExternalReply } from "modeldispatcher-react-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deviceChat } from "@/lib/ai/deviceChat";
import { AiSettings, api, ApiError, ChatMsg, DispatcherErrorBody, ModelChoice } from "@/lib/api";
import { loadDeviceAiSettings, type DeviceAiSettings } from "@/lib/data/aiSettings";
import { useI18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { useApi } from "@/lib/useApi";

/** Errors ModelDispatcher wants the user to act on: open AI settings / the key wizard. */
function needsKeys(e: unknown): boolean {
  if (e instanceof NoProviderConfiguredError) return true;
  if (!(e instanceof ApiError)) return false;
  const body = e.body as DispatcherErrorBody | undefined;
  return body?.action === "trigger_key_wizard" || body?.action === "open_ai_settings" || body?.error === "quota_exceeded";
}

export default function ChatPanel({ symbol, height = 520, suggestions = [] }: { symbol?: string; height?: number; suggestions?: string[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { on: local, ready } = useLocalMode();
  // In local mode the keys and the chat stay on the device: nothing here asks the server.
  const { data: models } = useApi<ModelChoice[]>(ready && !local ? "/ai/models" : null);
  const { data: settings } = useApi<AiSettings>(ready && !local ? "/ai/settings" : null);
  const [device, setDevice] = useState<DeviceAiSettings | null>(null);
  const [model, setModel] = useState("auto");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [keyWizard, setKeyWizard] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, busy]);

  useEffect(() => {
    if (!ready || !local) return;
    let live = true;
    loadDeviceAiSettings()
      .then((s) => live && setDevice(s))
      .catch((e: unknown) => live && setErr((e as Error).message));
    return () => {
      live = false;
    };
  }, [ready, local]);

  const favorite = (local ? device?.favorite : settings?.favorite) ?? null;
  const noProvider = local ? device !== null && device.config.providers.length === 0 : models !== null && !models.some((m) => m.available);
  const lastQuestion = input.trim() || [...msgs].reverse().find((m) => m.role === "user")?.content || "";
  const externalQuestion = lastQuestion && symbol ? t("ai.externalQuestion", { symbol, question: lastQuestion }) : lastQuestion;

  async function send(text: string) {
    // Before the mode is known, or while device settings load, sending could reach the server.
    if (!text.trim() || busy || !ready || (local && !device)) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setErr(null);
    setKeyWizard(false);
    try {
      const r = local
        ? await deviceChat(device?.config ?? { providers: [], ollamaUrl: "" }, next, symbol, lang)
        : await api<{ model: string; content: string; tools_used: string[] }>("/ai/chat", {
          method: "POST",
          json: { model, symbol, language: lang, messages: next.map(({ role, content }) => ({ role, content })) },
        }).then((s) => ({ content: s.content, model: s.model, toolsUsed: s.tools_used }));
      const meta = `${r.model}${r.toolsUsed.length ? " · " + [...new Set(r.toolsUsed)].join(", ") : ""}`;
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
        <h2 style={{ margin: 0 }}>{symbol ? t("ai.askAbout", { symbol }) : t("ai.analyst")}</h2>
        {!local && (
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ maxWidth: 280, flex: "0 1 auto" }} aria-label={t("ai.model")}>
            {models?.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.available}>{m.available ? m.label : t("ai.notSetUp", { label: m.label })}</option>
            ))}
          </select>
        )}
      </div>

      {noProvider ? (
        <NoProviderPrompt favorite={favorite} question={externalQuestion} onOpenSettings={() => router.push("/settings")} locale={lang} />
      ) : (
        <>
          <ConversationIntro locale={lang} />
          <div className="msgs" style={{ height }}>
            {!msgs.length && (
              <div className="empty">
                <div style={{ marginBottom: 10 }}>{t("ai.agentReads")}</div>
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
            {busy && <div className="msg assistant sub">{t("ai.thinking")}</div>}
            <div ref={end} />
          </div>
        </>
      )}

      {err && (
        <div className="err">
          {err}
          {keyWizard && <> · <Link href="/settings" style={{ textDecoration: "underline" }}>{t("ai.addKey")}</Link></>}
        </div>
      )}

      {!noProvider && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("ai.inputPlaceholder")} aria-label={t("ai.message")} />
          <button className="btn primary" disabled={busy || !input.trim()}>{t("ai.send")}</button>
        </form>
      )}

      {favorite && (
        <div className="grid" style={{ gap: 8 }}>
          <AskExternallyButton favorite={favorite} question={externalQuestion} locale={lang} />
          <PasteExternalReply
            label={t("ai.pasteLabel")}
            placeholder={t("ai.pastePlaceholder")}
            applyLabel={t("ai.pasteApply")}
            onApply={(raw) => setMsgs((m) => [...m, { role: "assistant", content: raw, meta: t("ai.pastedFrom", { app: favorite }) }])}
          />
        </div>
      )}
      <div className="sub" style={{ fontSize: 11 }}>{t("common.notAdvice")}</div>
    </div>
  );
}
