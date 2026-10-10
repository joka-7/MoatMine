"use client";

import { useEffect, useState } from "react";
import AiSettingsCard from "@/components/AiSettingsCard";
import { api, apiBase, devToken } from "@/lib/api";
import { FIREBASE_CONFIGURED } from "@/lib/firebase";
import { date } from "@/lib/format";
import { useApi } from "@/lib/useApi";

export default function SettingsPage() {
  return (
    <>
      <div className="topbar"><h1>Settings</h1></div>
      <div className="grid g2">
        <AiSettingsCard />
        <Connection />
        <McpTokens />
      </div>
    </>
  );
}

function Connection() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string>("");
  useEffect(() => { setUrl(apiBase()); setToken(devToken()); }, []);
  const save = async () => {
    localStorage.setItem("moatmine.api", url);
    if (!FIREBASE_CONFIGURED) localStorage.setItem("moatmine.token", token);
    // an authenticated call, so a wrong token fails here too, not just a wrong URL
    try { await api("/safety/profile"); setStatus("Connected and signed in"); }
    catch (e) { setStatus(`Failed: ${(e as Error).message}`); }
  };
  return (
    <div className="card">
      <h2>Connection</h2>
      <div className="grid" style={{ gap: 10 }}>
        <label className="f">API URL (Render)<input value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        {FIREBASE_CONFIGURED ? (
          <div className="sub" style={{ fontSize: 12 }}>Signed in with your MoatMine account.</div>
        ) : (
          <label className="f">Dev user token <span>(local dev mode only; production signs in with Firebase)</span><input value={token} onChange={(e) => setToken(e.target.value)} /></label>
        )}
        <div className="row" style={{ alignItems: "center" }}>
          <span className="sub">{status}</span>
          <button className="btn primary" onClick={save}>Save & test</button>
        </div>
      </div>
    </div>
  );
}

function McpTokens() {
  const { data, reload } = useApi<{ id: number; label: string; created_at: string }[]>("/ai/mcp-tokens");
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="card">
      <h2>MCP access</h2>
      <div className="sub" style={{ fontSize: 12, marginBottom: 10 }}>
        Let Claude Desktop / Claude Code or another MCP client read your portfolio. Server URL: <code>{apiBase()}/mcp/</code>
      </div>
      {fresh && (
        <div className="card" style={{ background: "var(--bg)", marginBottom: 10 }}>
          <div className="sub" style={{ fontSize: 12 }}>Copy now. It won&apos;t be shown again.</div>
          <code style={{ wordBreak: "break-all" }}>{fresh}</code>
        </div>
      )}
      {data?.map((t) => (
        <div key={t.id} className="row" style={{ alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
          <span>{t.label || "token"}</span><span className="sub">{date(t.created_at)}</span>
          <button className="btn sm" onClick={async () => { await api(`/ai/mcp-tokens/${t.id}`, { method: "DELETE" }); reload(); }}>Revoke</button>
        </div>
      ))}
      <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => {
        e.preventDefault();
        const r = await api<{ token: string }>(`/ai/mcp-tokens?label=${encodeURIComponent(label)}`, { method: "POST" });
        setFresh(r.token); setLabel(""); reload();
      }}>
        <input placeholder="Label, e.g. Claude Desktop" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn primary">Create token</button>
      </form>
    </div>
  );
}
