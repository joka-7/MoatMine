"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useIntroSeen } from "@/lib/useIntroSeen";

const STEPS = ["welcome", "rules", "targets", "checks", "ai", "start"] as const;

export default function WelcomePage() {
  const { t } = useI18n();
  const { markSeen } = useIntroSeen();
  const [index, setIndex] = useState(0);
  const step = STEPS[index] ?? STEPS[0];
  const last = index === STEPS.length - 1;

  return (
    <>
      <div className="topbar">
        <h1>{t("intro.title")}</h1>
        <Link href="/" className="btn ghost sm" onClick={markSeen}>{t("intro.skip")}</Link>
      </div>
      <section className="card intro" aria-live="polite">
        <div className="sub">{t("intro.stepOf", { n: index + 1, total: STEPS.length })}</div>
        <div className="steps" aria-hidden="true">
          {STEPS.map((s, i) => <i key={s} className={i <= index ? "on" : ""} />)}
        </div>
        <h2 className="intro-title">{t(`intro.${step}.title` as MessageKey)}</h2>
        <p>{t(`intro.${step}.body` as MessageKey)}</p>
        {last ? (
          <div className="row" style={{ marginTop: 16 }}>
            <Link href="/learn" className="btn primary" onClick={markSeen}>{t("intro.start.learn")}</Link>
            <Link href="/risk-profile" className="btn" onClick={markSeen}>{t("intro.start.profile")}</Link>
            <Link href="/" className="btn ghost" onClick={markSeen}>{t("intro.start.dashboard")}</Link>
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <button className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>{t("intro.back")}</button>
          {last ? null : <button className="btn primary" onClick={() => setIndex(index + 1)}>{t("intro.next")}</button>}
        </div>
      </section>
    </>
  );
}
