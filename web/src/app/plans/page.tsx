"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { CheckView } from "@/components/SafetyBits";
import { api, BuyPlan } from "@/lib/api";
import { date, money } from "@/lib/format";
import { useI18n, type I18n, type MessageKey } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

const STATUS: Record<BuyPlan["status"], string> = {
  ready: "ok", cooling_off: "", blocked: "below_min", executing: "", executed: "reached", cancelled: "",
};

const STATUS_LABEL: Record<BuyPlan["status"], MessageKey> = {
  ready: "dashboard.plans.status.ready",
  cooling_off: "dashboard.plans.status.cooling_off",
  blocked: "dashboard.plans.status.blocked",
  executing: "dashboard.plans.status.executing",
  executed: "dashboard.plans.status.executed",
  cancelled: "dashboard.plans.status.cancelled",
};

function left(iso: string, now: number, t: I18n["t"]) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return t("dashboard.plans.now");
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? t("dashboard.plans.hoursMinutes", { h, m }) : t("dashboard.plans.minutes", { m });
}

export default function PlansPage() {
  const { t, lang } = useI18n();
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
          <h1>{t("dashboard.plans.title")}</h1>
          <div className="sub">{t("dashboard.plans.intro")}</div>
        </div>
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="card">
        <div className="scroll-x">
          <table>
            <thead><tr><th>{t("dashboard.plans.stock")}</th><th className="n">{t("dashboard.plans.shares")}</th><th className="n">{t("dashboard.plans.amount")}</th><th>{t("dashboard.plans.status")}</th><th>{t("dashboard.plans.reason")}</th><th /></tr></thead>
            <tbody>
              {data?.map((p) => (
                <Fragment key={p.id}>
                  <tr onClick={() => setOpen(open === p.id ? null : p.id)} style={{ cursor: "pointer" }}>
                    <td><Link className="sym" href={`/stock?s=${p.symbol}&tab=safety`} onClick={(e) => e.stopPropagation()}>{p.symbol}</Link> <span className="sub" style={{ fontSize: 11 }}>{date(p.created_at, lang)}</span></td>
                    <td className="n">{p.quantity}</td>
                    <td className="n">{money(p.amount)}</td>
                    <td>
                      <span className={`chip ${STATUS[p.status]}`}>{p.status in STATUS_LABEL ? t(STATUS_LABEL[p.status]) : p.status}</span>
                      {p.status === "cooling_off" && <span className="sub" style={{ fontSize: 12 }}> · {left(p.available_at, now, t)}</span>}
                    </td>
                    <td className="sub" style={{ maxWidth: 280, fontSize: 12 }}>{p.note || "—"}</td>
                    <td style={{ textAlign: "end", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      {p.status === "ready" && <button className="btn sm primary" onClick={() => act(p.id, "execute")}>{t("dashboard.plans.execute")}</button>}{" "}
                      {["ready", "cooling_off", "blocked"].includes(p.status) && <button className="btn sm" onClick={() => act(p.id, "cancel")}>{t("common.cancel")}</button>}
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
        {data && !data.length && <div className="empty">{t("dashboard.plans.empty")}</div>}
      </div>
    </>
  );
}
