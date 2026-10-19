"use client";

import { useState } from "react";
import { passMark } from "@/lib/learn/progress";
import type { LearnModule } from "@/lib/learn";
import { useI18n } from "@/lib/i18n";

interface Props {
  readonly module: LearnModule;
  readonly onScore: (score: number) => void;
}

export default function LearnQuiz({ module, onScore }: Props) {
  const { t, lang } = useI18n();
  const [picked, setPicked] = useState<readonly (number | undefined)[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const total = module.quiz.length;
  const answeredAll = module.quiz.every((_, i) => picked[i] !== undefined);

  const check = () => {
    const correct = module.quiz.filter((q, i) => picked[i] === q.answer).length;
    setScore(correct);
    onScore(correct);
  };
  const retry = () => {
    setPicked([]);
    setScore(null);
  };

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>{t("learn.quiz")}</h2>
      <p className="sub">{t("learn.quizIntro", { need: passMark(module), total })}</p>
      {module.quiz.map((q, qi) => (
        <fieldset key={q.prompt.en} className="quiz-q" disabled={score !== null}>
          <legend>{q.prompt[lang]}</legend>
          {q.options.map((o, oi) => (
            <label key={o.en} className="quiz-opt">
              <input
                type="radio"
                name={`${module.id}-${qi}`}
                checked={picked[qi] === oi}
                onChange={() => setPicked(module.quiz.map((_, i) => (i === qi ? oi : picked[i])))}
              />
              {o[lang]}
            </label>
          ))}
          {score !== null ? (
            <p className={picked[qi] === q.answer ? "up" : "down"}>
              <b>{picked[qi] === q.answer ? t("learn.correct") : t("learn.wrong")}</b> {q.explanation[lang]}
            </p>
          ) : null}
        </fieldset>
      ))}
      {score === null ? (
        <button className="btn primary" disabled={!answeredAll} onClick={check}>{t("learn.check")}</button>
      ) : (
        <div className="row" style={{ alignItems: "center" }}>
          <span>
            <b>{t("learn.score", { score, total })}</b>{" "}
            {score >= passMark(module) ? t("learn.passed") : null}
          </span>
          <button className="btn" onClick={retry}>{t("learn.retry")}</button>
        </div>
      )}
    </section>
  );
}
