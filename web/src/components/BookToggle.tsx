"use client";

import type { BookMode } from "@/lib/useBookMode";

const OPTIONS: readonly { mode: BookMode; label: string }[] = [
  { mode: "real", label: "Real money" },
  { mode: "paper", label: "Paper" },
];

export default function BookToggle({ mode, onChange }: { mode: BookMode; onChange: (mode: BookMode) => void }) {
  return (
    <div className="seg" role="group" aria-label="Which accounts to show" style={{ flex: "0 1 auto" }}>
      {OPTIONS.map((o) => (
        <button key={o.mode} type="button" className={`btn sm ${o.mode === mode ? "on" : ""}`} aria-pressed={o.mode === mode} onClick={() => onChange(o.mode)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PaperNotice() {
  return (
    <div className="card sub" style={{ marginBottom: 16 }}>
      Paper (practice) accounts only. None of this counts toward your real-money totals, risk or alerts.
    </div>
  );
}
