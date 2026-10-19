"use client";

import Link from "next/link";
import LearnQuiz from "@/components/LearnQuiz";
import { useI18n } from "@/lib/i18n";
import { LEARN_MODULES, type LearnModule } from "@/lib/learn";

interface Props {
  readonly module: LearnModule;
  readonly onScore: (score: number) => void;
}

export default function LearnModuleView({ module, onScore }: Props) {
  const { t, lang } = useI18n();
  const next = LEARN_MODULES[LEARN_MODULES.findIndex((m) => m.id === module.id) + 1];

  return (
    <>
      <div className="topbar">
        <h1>{module.title[lang]}</h1>
        <Link href="/learn" className="btn ghost sm">{t("learn.all")}</Link>
      </div>
      {module.lessons.map((lesson, i) => (
        <article key={lesson.title.en} className="card lesson">
          <h2>{t("learn.lesson", { n: i + 1 })}</h2>
          <h3>{lesson.title[lang]}</h3>
          {lesson.body.map((p) => <p key={p.en}>{p[lang]}</p>)}
          {lesson.tryIt ? <Link href={lesson.tryIt} className="btn sm">{t("learn.tryIt")}</Link> : null}
        </article>
      ))}
      <LearnQuiz module={module} onScore={onScore} />
      <div className="row" style={{ marginTop: 16, alignItems: "center", justifyContent: "space-between" }}>
        <span className="sub">{t("learn.disclaimer")}</span>
        {next ? <Link href={`/learn?m=${next.id}`} className="btn">{t("learn.nextModule")}</Link> : null}
      </div>
    </>
  );
}
