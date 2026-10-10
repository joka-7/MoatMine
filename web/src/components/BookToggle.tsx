"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import type { BookMode } from "@/lib/useBookMode";

const OPTIONS: readonly { mode: BookMode; label: MessageKey }[] = [
  { mode: "real", label: "dashboard.book.real" },
  { mode: "paper", label: "dashboard.book.paper" },
];

export default function BookToggle({ mode, onChange }: { mode: BookMode; onChange: (mode: BookMode) => void }) {
  const { t } = useI18n();
  return (
    <div className="seg" role="group" aria-label={t("dashboard.book.label")} style={{ flex: "0 1 auto" }}>
      {OPTIONS.map((o) => (
        <button key={o.mode} type="button" className={`btn sm ${o.mode === mode ? "on" : ""}`} aria-pressed={o.mode === mode} onClick={() => onChange(o.mode)}>
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}

export function PaperNotice() {
  const { t } = useI18n();
  return (
    <div className="card sub" style={{ marginBottom: 16 }}>
      {t("dashboard.book.paperNotice")}
    </div>
  );
}
