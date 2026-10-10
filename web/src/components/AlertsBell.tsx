"use client";

import { useState } from "react";
import { Alert, api } from "@/lib/api";
import { date } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

export default function AlertsBell() {
  const { t, lang } = useI18n();
  const { data, reload } = useApi<Alert[]>("/alerts");
  const [open, setOpen] = useState(false);
  const unread = data?.filter((a) => !a.read).length ?? 0;
  return (
    <div className="bell">
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-label={t("dashboard.alerts.title")}>
        {t("dashboard.alerts.title")} {unread > 0 && <span className="dot">{unread}</span>}
      </button>
      {open && (
        <div className="card pop">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{t("dashboard.alerts.title")}</h2>
            <button className="btn sm" style={{ flex: "0 1 auto" }} onClick={async () => { await api("/alerts/read-all", { method: "POST" }); reload(); }}>
              {t("dashboard.alerts.markAllRead")}
            </button>
          </div>
          {!data?.length && <div className="empty">{t("dashboard.alerts.empty")}</div>}
          {data?.map((a) => (
            <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", opacity: a.read ? 0.55 : 1 }}>
              <div>{a.message}</div>
              <div className="sub" style={{ fontSize: 11 }}>{a.source} · {date(a.created_at, lang)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
