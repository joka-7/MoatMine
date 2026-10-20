"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LEARN_MODULES, LESSON_MEDIA, type LearnModule, type MediaLink } from "@/lib/learn";

interface Props {
  readonly module: LearnModule;
  readonly complete: boolean;
  readonly onToggleComplete: (done: boolean) => void;
}

export default function LearnModuleView({ module, complete, onToggleComplete }: Props) {
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
          <details className="more">
            <summary>{t("learn.details")}</summary>
            {lesson.details.map((p) => <p key={p.en}>{p[lang]}</p>)}
          </details>
          <details className="more">
            <summary>{t("learn.examples", { count: lesson.examples.length })}</summary>
            <ul>
              {lesson.examples.map((e) => <li key={e.en}>{e[lang]}</li>)}
            </ul>
          </details>
          <LessonMedia links={LESSON_MEDIA[module.id]?.[i] ?? []} />
          {lesson.tryIt ? <Link href={lesson.tryIt} className="btn sm">{t("learn.tryIt")}</Link> : null}
        </article>
      ))}
      <div className="row" style={{ marginTop: 16, alignItems: "center", justifyContent: "space-between" }}>
        <span className="sub">{t("learn.disclaimer")}</span>
        <button className={complete ? "btn" : "btn primary"} onClick={() => onToggleComplete(!complete)}>
          {complete ? t("learn.markUndone") : t("learn.markDone")}
        </button>
        {next ? <Link href={`/learn?m=${next.id}`} className="btn">{t("learn.nextModule")}</Link> : null}
      </div>
    </>
  );
}

/** Links to other people's videos and podcasts, those in the display language first. */
function LessonMedia({ links }: { readonly links: readonly MediaLink[] }) {
  const { t, lang } = useI18n();
  if (links.length === 0) return null;
  const ordered = [...links].sort((a, b) => Number(b.lang === lang) - Number(a.lang === lang));
  return (
    <details className="more">
      <summary>{t("learn.media", { count: links.length })}</summary>
      <p className="sub">{t("learn.mediaNote")}</p>
      <ul>
        {ordered.map((m) => (
          <li key={m.url}>
            <a href={m.url} target="_blank" rel="noreferrer" dir="auto">{m.title}</a>
            <div className="sub">
              {[m.channel, t(m.kind === "video" ? "learn.kind.video" : "learn.kind.podcast"), t("learn.minutes", { n: m.minutes }), t(m.lang === "he" ? "lang.he" : "lang.en")].join(" · ")}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
