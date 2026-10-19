"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import LearnModuleView from "@/components/LearnModuleView";
import { useI18n } from "@/lib/i18n";
import { LEARN_MODULES } from "@/lib/learn";
import { completedCount, isComplete } from "@/lib/learn/progress";
import { useLearnProgress } from "@/lib/useLearnProgress";

// Query-param route (/learn?m=risk) so it works in the static desktop export too.
export default function LearnPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="empty">{t("common.loading")}</div>}>
      <Learn />
    </Suspense>
  );
}

function Learn() {
  const { t, lang } = useI18n();
  const [progress, mark] = useLearnProgress();
  const id = useSearchParams().get("m");

  if (id !== null) {
    const selected = LEARN_MODULES.find((m) => m.id === id);
    if (!selected) return <div className="empty">{t("learn.notFound")}</div>;
    return (
      <LearnModuleView
        key={selected.id}
        module={selected}
        complete={isComplete(selected, progress)}
        onToggleComplete={(done) => mark(selected.id, done)}
      />
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>{t("learn.title")}</h1>
        <span className="sub">{t("learn.progress", { done: completedCount(LEARN_MODULES, progress), total: LEARN_MODULES.length })}</span>
      </div>
      <p className="sub">{t("learn.sub")}</p>
      <div className="grid g2">
        {LEARN_MODULES.map((m, i) => {
          const done = isComplete(m, progress);
          return (
            <div key={m.id} className="card">
              <h2>{i + 1} · {t("learn.lessons", { count: m.lessons.length })}</h2>
              <h3>{m.title[lang]}</h3>
              <p className="sub">{m.summary[lang]}</p>
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <span className="up">{done ? t("learn.completed") : null}</span>
                <Link href={`/learn?m=${m.id}`} className="btn primary">
                  {done ? t("learn.review") : t("learn.start")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
