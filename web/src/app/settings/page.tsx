"use client";

import { useEffect, useState } from "react";
import { api, apiBase, authToken } from "@/lib/api";
import { date } from "@/lib/format";
import { useApi } from "@/lib/useApi";

type KeyRow = { provider: string; masked: string; base_url: string; model: string };

export default function SettingsPage() {
  return (
    <>
      <div className="topbar"><h1>Settings</h1></div>
      <div className="grid g2">
        <Connection />
        <Keys />
        <External />
        <McpTokens />
      </div>
    </>
  );
}

function Connection() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string>("");
  useEffect(() => { setUrl(apiBase()); setToken(authToken()); }, []);
  const save = async () => {
    localStorage.setItem("folio.api", url);
    localStorage.setItem("folio.token", token);
    try { const h = await api<{ market_provider: string }>("/health"); setStatus(`Connected · market data: ${h.market_provider}`); }
    catch (e) { setStatus(`Failed: ${(e as Error).message}`); }
  };
  return (
    <div className="card">
      <h2>Connection</h2>
      <div className="grid" style={{ gap: 10 }}>
        <label className="f">API URL (Render)<input value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label className="f">Dev user token <span>(replaced by sign-in when AUTH_MODE=clerk)</span><input value={token} onChange={(e) => setToken(e.target.value)} /></label>
        <div className="row" style={{ alignItems: "center" }}>
          <span className="sub">{status}</span>
          <button className="btn primary" onClick={save}>Save & test</button>
        </div>
      </div>
    </div>
  );
}

function Keys() {
  const { data, reload } = useApi<KeyRow[]>("/ai/keys");
  const [provider, setProvider] = useState("anthropic");
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card">
      <h2>Your AI keys</h2>
      <div className="sub" style={{ fontSize: 12, marginBottom: 10 }}>Encrypted at rest on the server. Your key is used before the server's own key.</div>
      {data?.filter((k) => k.provider !== "external").map((k) => (
        <div key={k.provider} className="row" style={{ alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
          <b>{k.provider}</b><span className="num sub">{k.masked}</span>
          <button className="btn sm" onClick={async () => { await api(`/ai/keys/${k.provider}`, { method: "DELETE" }); reload(); }}>Remove</button>
        </div>
      ))}
      {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
      <form className="row" style={{ marginTop: 10 }} onSubmit={async (e) => {
        e.preventDefault();
        try { setErr(null); await api("/ai/keys", { method: "PUT", json: { provider, api_key: key } }); setKey(""); reload(); }
        catch (e) { setErr((e as Error).message); }
      }}>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option>
        </select>
        <input type="password" required placeholder="API key" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn primary">Save</button>
      </form>
    </div>
  );
}

function External() {
  const { data, reload } = useApi<KeyRow[]>("/ai/keys");
  const ext = data?.find((k) => k.provider === "external");
  const [f, setF] = useState({ base_url: "", model: "", api_key: "" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card">
      <h2>External agent</h2>
      <div className="sub" style={{ fontSize: 12, marginBottom: 10 }}>
        Any OpenAI-compatible <code>/chat/completions</code> endpoint (your own agent, OpenRouter, a self-hosted model). Pick “My external agent” in the chat.
      </div>
      {ext && <div className="row" style={{ alignItems: "center", marginBottom: 10 }}><span className="sub">{ext.base_url} · {ext.model || "default"} · {ext.masked}</span>
        <button className="btn sm" onClick={async () => { await api("/ai/keys/external", { method: "DELETE" }); reload(); }}>Remove</button></div>}
      {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
      <form className="grid" style={{ gap: 8 }} onSubmit={async (e) => {
        e.preventDefault();
        try { setErr(null); await api("/ai/keys", { method: "PUT", json: { provider: "external", ...f } }); setF({ base_url: "", model: "", api_key: "" }); reload(); }
        catch (e) { setErr((e as Error).message); }
      }}>
        <input required placeholder="https://my-agent.example.com/v1/chat/completions" value={f.base_url} onChange={(e) => setF({ ...f, base_url: e.target.value })} />
        <div className="row">
          <input placeholder="model (optional)" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
          <input type="password" required placeholder="API key" value={f.api_key} onChange={(e) => setF({ ...f, api_key: e.target.value })} />
          <button className="btn primary">Save</button>
        </div>
      </form>
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
          <div className="sub" style={{ fontSize: 12 }}>Copy now. It won't be shown again.</div>
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
