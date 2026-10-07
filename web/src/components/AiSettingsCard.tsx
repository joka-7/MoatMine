"use client";

import { ModelPicker } from "modeldispatcher-react-ui";
import { useEffect, useState } from "react";
import type { AgentConfig, ExternalChatProviderId } from "modeldispatcher-browser-agent";
import { AiSettings, api, ExternalAgent } from "@/lib/api";
import { useApi } from "@/lib/useApi";

/**
 * AI settings on ModelDispatcher's shared <ModelPicker>: vendors in fallback order, a model each,
 * pooled keys, and a favorite free AI app. Saved to the backend (encrypted), not localStorage,
 * so the same settings follow the user to web, desktop and Android.
 */
export default function AiSettingsCard() {
  const { data, setData } = useApi<AiSettings>("/ai/settings");
  const [config, setConfig] = useState<AgentConfig>({ providers: [], ollamaUrl: "" });
  const [favorite, setFavorite] = useState<ExternalChatProviderId | null>(null);
  const [ext, setExt] = useState<ExternalAgent>({ base_url: "", model: "", api_key: "" });
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setConfig(data.config);
    setFavorite(data.favorite);
    setExt(data.external ?? { base_url: "", model: "", api_key: "" });
    setDirty(false);
  }, [data]);

  const save = async () => {
    try {
      const out = await api<AiSettings>("/ai/settings", {
        method: "PUT",
        json: { config, favorite, external: ext.base_url ? ext : null },
      });
      setData(out);
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const ollama = config.providers.some((p) => p.provider === "ollama");

  return (
    <div className="card span2">
      <h2>AI · ModelDispatcher</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        Add one or more AI providers. The list is a fallback order: if one fails or runs out, the next is tried, and several keys
        per provider are tried in turn. Keys are encrypted on the server and never shown in full again.
        {data?.server_vendors.length ? ` Already available without your own key: ${data.server_vendors.join(", ")}.` : ""}
      </p>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <ModelPicker
          config={config}
          onConfigChange={(next) => { setConfig(next); setDirty(true); }}
          externalChatFavorite={favorite}
          onExternalChatFavoriteChange={(next) => { setFavorite(next); setDirty(true); }}
        />
        <div className="grid" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>External agent</h2>
          <div className="sub" style={{ fontSize: 12 }}>
            Your own agent or any OpenAI-compatible API (OpenRouter, a self-hosted model…). Give the base URL, e.g.
            <code> https://openrouter.ai/api/v1</code>. Pick &quot;My external agent&quot; in the chat to use it.
          </div>
          <input placeholder="https://…/v1" value={ext.base_url} onChange={(e) => { setExt({ ...ext, base_url: e.target.value }); setDirty(true); }} />
          <div className="row">
            <input placeholder="model" value={ext.model} onChange={(e) => { setExt({ ...ext, model: e.target.value }); setDirty(true); }} />
            <input type="password" placeholder="API key" value={ext.api_key} onChange={(e) => { setExt({ ...ext, api_key: e.target.value }); setDirty(true); }} />
          </div>
          {ext.base_url && (
            <button className="btn sm" style={{ justifySelf: "start" }} onClick={() => { setExt({ base_url: "", model: "", api_key: "" }); setDirty(true); }}>
              Remove external agent
            </button>
          )}
          {ollama && <div className="sub" style={{ fontSize: 12 }}>Ollama runs on your own machine, so the server can&apos;t reach it; it&apos;s skipped for chat here.</div>}
        </div>
      </div>
      <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
        <span className="sub">{msg}</span>
        <button className="btn primary" onClick={save} disabled={!dirty}>Save AI settings</button>
      </div>
    </div>
  );
}
