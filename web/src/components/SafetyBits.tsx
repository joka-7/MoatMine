"use client";

import { CheckResult, Grade } from "@/lib/api";
import { money } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n";

export const GRADE_COLOR: Record<Grade, string> = { A: "#49c58c", B: "#8fd16a", C: "#e8b04a", D: "#ec8a50", F: "#ec6650" };

export function GradeBadge({ grade, size = 28 }: { grade: Grade | null; size?: number }) {
  const { t } = useI18n();
  const c = grade ? GRADE_COLOR[grade] : "#3a404a";
  return (
    <span
      aria-label={grade ? t("risk.gradeAria", { grade }) : t("risk.noGrade")}
      style={{
        display: "inline-grid", placeItems: "center", width: size, height: size, borderRadius: 8, fontWeight: 700,
        fontSize: size * 0.5, color: c, border: `1px solid ${c}`, background: `color-mix(in srgb, ${c} 12%, transparent)`,
      }}
    >
      {grade ?? "–"}
    </span>
  );
}

export function ScoreRing({ score, grade }: { score: number | null; grade: Grade | null }) {
  const { t } = useI18n();
  const r = 46, c = 2 * Math.PI * r;
  const color = grade ? GRADE_COLOR[grade] : "#3a404a";
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={t("risk.scoreAria", { score: score ?? t("risk.unknown") })}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1d2128" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${((score ?? 0) / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fill="#ece8df" fontSize="28" fontWeight="700" fontFamily="ui-monospace, monospace">{score ?? "—"}</text>
      <text x="60" y="80" textAnchor="middle" fill={color} fontSize="14" fontWeight="600">{grade ? t("risk.gradeLabel", { grade }) : t("risk.noData")}</text>
    </svg>
  );
}

const VERDICT: Record<CheckResult["verdict"], { label: MessageKey; cls: string }> = {
  pass: { label: "risk.verdict.pass", cls: "ok" },
  warn: { label: "risk.verdict.warn", cls: "" },
  block: { label: "risk.verdict.block", cls: "below_min" },
};

export function CheckView({ check }: { check: CheckResult }) {
  const { t } = useI18n();
  const v = VERDICT[check.verdict];
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span className={`chip ${v.cls}`} style={{ fontSize: 12 }}>{t(v.label)}</span>
        <span className="sub">{check.symbol} · {money(check.amount)}</span>
        {check.safety.grade && <span className="sub">{t("risk.safety")} <GradeBadge grade={check.safety.grade} size={20} /> {check.safety.score}</span>}
      </div>
      {check.checks.map((c) => (
        <div key={c.rule} style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: 13 }}>
          <span className={c.status === "pass" ? "up" : c.status === "fail" ? "down" : ""} style={{ color: c.status === "warn" ? "var(--warn)" : undefined }}>
            {c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "!"}
          </span>
          <span>{c.message}</span>
        </div>
      ))}
      {check.verdict === "warn" && (
        <div className="sub" style={{ fontSize: 12, marginTop: 6 }}>
          {check.cooling_off_hours ? t("risk.goAheadCooling", { hours: check.cooling_off_hours }) : t("risk.goAhead")}
        </div>
      )}
    </div>
  );
}
