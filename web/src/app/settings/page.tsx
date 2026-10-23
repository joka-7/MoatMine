"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AiSettingsCard from "@/components/AiSettingsCard";
import DeviceDataCard from "@/components/DeviceDataCard";
import LanguageSwitch from "@/components/LanguageSwitch";
import ThemeSwitch from "@/components/ThemeSwitch";
import { api, apiBase, devToken } from "@/lib/api";
import { FIREBASE_CONFIGURED } from "@/lib/firebase";
import { date } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <>
      <div className="topbar"><h1>{t("nav.settings")}</h1></div>
      <div className="grid g2">
        <div className="card">
          <h2>{t("lang.label")}</h2>
          <LanguageSwitch />
        </div>
        <div className="card">
          <h2>{t("theme.label")}</h2>
          <ThemeSwitch />
        </div>
        <div className="card">
          <h2>{t("intro.replay.title")}</h2>
          <p className="sub">{t("intro.replay.body")}</p>
          <Link href="/welcome" className="btn">{t("intro.replay.button")}</Link>
        </div>
        <DeviceDataCard />
        <AiSettingsCard />
        <Connection />
        <McpTokens />
      </div>
    </>
  );
}

function Connection() {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string>("");
  useEffect(() => { setUrl(apiBase()); setToken(devToken()); }, []);
  const save = async () => {
    localStorage.setItem("moatmine.api", url);
    if (!FIREBASE_CONFIGURED) localStorage.setItem("moatmine.token", token);
    // an authenticated call, so a wrong token fails here too, not just a wrong URL
    try { await api("/safety/profile"); setStatus(t("ai.connected")); }
    catch (e) { setStatus(t("ai.failed", { error: (e as Error).message })); }
  };
  return (
    <div className="card">
      <h2>{t("ai.connection")}</h2>
      <div className="grid" style={{ gap: 10 }}>
        <label className="f">{t("ai.apiUrl")}<input value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        {FIREBASE_CONFIGURED ? (
          <div className="sub" style={{ fontSize: 12 }}>{t("ai.signedIn")}</div>
        ) : (
          <label className="f">{t("ai.devToken")} <span>{t("ai.devTokenHint")}</span><input value={token} onChange={(e) => setToken(e.target.value)} /></label>
        )}
        <div className="row" style={{ alignItems: "center" }}>
          <span className="sub">{status}</span>
          <button className="btn primary" onClick={save}>{t("ai.saveTest")}</button>
        </div>
      </div>
    </div>
  );
}

function McpTokens() {
  const { t, lang } = useI18n();
  const { data, reload } = useApi<{ id: number; label: string; created_at: string }[]>("/ai/mcp-tokens");
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="card">
      <h2>{t("ai.mcpTitle")}</h2>
      <div className="sub" style={{ fontSize: 12, marginBottom: 10 }}>
        {t("ai.mcpIntro")} <code>{apiBase()}/mcp/</code>
      </div>
      {fresh && (
        <div className="card" style={{ background: "var(--bg)", marginBottom: 10 }}>
          <div className="sub" style={{ fontSize: 12 }}>{t("ai.copyNow")}</div>
          <code style={{ wordBreak: "break-all" }}>{fresh}</code>
        </div>
      )}
      {data?.map((tok) => (
        <div key={tok.id} className="row" style={{ alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
          <span>{tok.label || t("ai.tokenFallback")}</span><span className="sub">{date(tok.created_at, lang)}</span>
          <button className="btn sm" onClick={async () => { await api(`/ai/mcp-tokens/${tok.id}`, { method: "DELETE" }); reload(); }}>{t("ai.revoke")}</button>
        </div>
      ))}
      <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => {
        e.preventDefault();
        const r = await api<{ token: string }>(`/ai/mcp-tokens?label=${encodeURIComponent(label)}`, { method: "POST" });
        setFresh(r.token); setLabel(""); reload();
      }}>
        <input placeholder={t("ai.tokenLabel")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn primary">{t("ai.createToken")}</button>
      </form>
    </div>
  );
}
