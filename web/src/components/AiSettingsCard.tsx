"use client";

import { ModelPicker } from "modeldispatcher-react-ui";
import { useEffect, useState } from "react";
import type { AgentConfig, ExternalChatProviderId } from "modeldispatcher-browser-agent";
import { AiSettings, api, ExternalAgent } from "@/lib/api";
import { loadDeviceAiSettings, saveDeviceAiSettings } from "@/lib/data/aiSettings";
import { useI18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { useApi } from "@/lib/useApi";

/**
 * AI settings on ModelDispatcher's shared <ModelPicker>: vendors in fallback order, a model each,
 * pooled keys, and a favorite free AI app. Saved to the backend (encrypted), so the same settings
 * follow the user to web, desktop and Android, or, in local mode, on this device only: the keys
 * never reach the server and the chat calls the AI provider from the browser.
 */
export default function AiSettingsCard() {
  const { t, lang } = useI18n();
  const { on: local, ready } = useLocalMode();
  const { data, setData } = useApi<AiSettings>(ready && !local ? "/ai/settings" : null);
  const [config, setConfig] = useState<AgentConfig>({ providers: [], ollamaUrl: "" });
  const [favorite, setFavorite] = useState<ExternalChatProviderId | null>(null);
  const [ext, setExt] = useState<ExternalAgent>({ base_url: "", model: "", api_key: "" });
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !local) return;
    let live = true;
    loadDeviceAiSettings()
      .then((s) => {
        if (!live) return;
        setConfig(s.config);
        setFavorite(s.favorite);
        setDirty(false);
      })
      .catch((e: unknown) => live && setMsg((e as Error).message));
    return () => {
      live = false;
    };
  }, [ready, local]);

  useEffect(() => {
    if (!data) return;
    setConfig(data.config);
    setFavorite(data.favorite);
    setExt(data.external ?? { base_url: "", model: "", api_key: "" });
    setDirty(false);
  }, [data]);

  const save = async () => {
    if (local) {
      try {
        await saveDeviceAiSettings({ config, favorite });
        setDirty(false);
        setMsg(t("ai.saved"));
      } catch (e) {
        setMsg((e as Error).message);
      }
      return;
    }
    try {
      const out = await api<AiSettings>("/ai/settings", {
        method: "PUT",
        json: { config, favorite, external: ext.base_url ? ext : null },
      });
      setData(out);
      setMsg(t("ai.saved"));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const ollama = config.providers.some((p) => p.provider === "ollama");

  return (
    <div className="card span2">
      <h2>{t("ai.settingsTitle")}</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        {local ? t("ai.settingsIntroDevice") : t("ai.settingsIntro")}
        {!local && data?.server_vendors.length ? t("ai.serverVendors", { vendors: data.server_vendors.join(", ") }) : ""}
      </p>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <ModelPicker
          config={config}
          onConfigChange={(next) => { setConfig(next); setDirty(true); }}
          externalChatFavorite={favorite}
          onExternalChatFavoriteChange={(next) => { setFavorite(next); setDirty(true); }}
          locale={lang}
        />
        {!local && <div className="grid" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>{t("ai.externalTitle")}</h2>
          <div className="sub" style={{ fontSize: 12 }}>
            {t("ai.externalIntro")}
            <code> https://openrouter.ai/api/v1</code>. {t("ai.externalPick")}
          </div>
          <input placeholder="https://…/v1" value={ext.base_url} onChange={(e) => { setExt({ ...ext, base_url: e.target.value }); setDirty(true); }} />
          <div className="row">
            <input placeholder={t("ai.modelPlaceholder")} value={ext.model} onChange={(e) => { setExt({ ...ext, model: e.target.value }); setDirty(true); }} />
            <input type="password" placeholder={t("ai.apiKeyPlaceholder")} value={ext.api_key} onChange={(e) => { setExt({ ...ext, api_key: e.target.value }); setDirty(true); }} />
          </div>
          {ext.base_url && (
            <button className="btn sm" style={{ justifySelf: "start" }} onClick={() => { setExt({ base_url: "", model: "", api_key: "" }); setDirty(true); }}>
              {t("ai.removeExternal")}
            </button>
          )}
          {ollama && <div className="sub" style={{ fontSize: 12 }}>{t("ai.ollamaSkipped")}</div>}
        </div>}
      </div>
      <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
        <span className="sub">{msg}</span>
        <button className="btn primary" onClick={save} disabled={!dirty}>{t("ai.saveSettings")}</button>
      </div>
    </div>
  );
}
