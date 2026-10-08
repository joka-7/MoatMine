"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { CheckView } from "@/components/SafetyBits";
import { api, BuyPlan } from "@/lib/api";
import { date, money } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const STATUS: Record<BuyPlan["status"], string> = {
  ready: "ok", cooling_off: "", blocked: "below_min", executing: "", executed: "reached", cancelled: "",
};

function left(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function PlansPage() {
  const { data, reload } = useApi<BuyPlan[]>("/plans");
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const act = async (id: number, action: "execute" | "cancel") => {
    try { setErr(null); await api(`/plans/${id}/${action}`, { method: "POST" }); reload(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Buy plans</h1>
          <div className="sub">Every buy is checked against your rules. Risky ones need a written reason and a cooling-off wait. Start one from a stock&apos;s Safety tab.</div>
        </div>
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="card">
        <div className="scroll-x">
          <table>
            <thead><tr><th>Stock</th><th className="n">Shares</th><th className="n">Amount</th><th>Status</th><th>Reason</th><th /></tr></thead>
            <tbody>
              {data?.map((p) => (
                <Fragment key={p.id}>
                  <tr onClick={() => setOpen(open === p.id ? null : p.id)} style={{ cursor: "pointer" }}>
                    <td><Link className="sym" href={`/stock?s=${p.symbol}&tab=safety`} onClick={(e) => e.stopPropagation()}>{p.symbol}</Link> <span className="sub" style={{ fontSize: 11 }}>{date(p.created_at)}</span></td>
                    <td className="n">{p.quantity}</td>
                    <td className="n">{money(p.amount)}</td>
                    <td>
                      <span className={`chip ${STATUS[p.status]}`}>{p.status.replace("_", " ")}</span>
                      {p.status === "cooling_off" && <span className="sub" style={{ fontSize: 12 }}> · {left(p.available_at, now)}</span>}
                    </td>
                    <td className="sub" style={{ maxWidth: 280, fontSize: 12 }}>{p.note || "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      {p.status === "ready" && <button className="btn sm primary" onClick={() => act(p.id, "execute")}>Execute</button>}{" "}
                      {["ready", "cooling_off", "blocked"].includes(p.status) && <button className="btn sm" onClick={() => act(p.id, "cancel")}>Cancel</button>}
                    </td>
                  </tr>
                  {open === p.id && (
                    <tr><td colSpan={6} style={{ background: "var(--bg)" }}><CheckView check={p.check} /></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.length && <div className="empty">No buy plans yet.</div>}
      </div>
    </>
  );
}
