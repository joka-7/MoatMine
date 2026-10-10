"use client";

import { LANGS, useI18n } from "@/lib/i18n";

/** English / עברית buttons; the choice is remembered on this device. */
export default function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="seg" role="group" aria-label={t("lang.label")}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} className={`btn sm ${l === lang ? "on" : ""}`} aria-pressed={l === lang} onClick={() => setLang(l)}>
          {t(l === "en" ? "lang.en" : "lang.he")}
        </button>
      ))}
    </div>
  );
}
