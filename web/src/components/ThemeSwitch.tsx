"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { THEME_CHOICES, useTheme, type ThemeChoice } from "@/lib/theme";

const LABEL: Readonly<Record<ThemeChoice, MessageKey>> = { light: "theme.light", dark: "theme.dark", system: "theme.system" };

/** Light / Dark / Match device buttons; the choice is remembered on this device. */
export default function ThemeSwitch() {
  const { t } = useI18n();
  const { choice, setChoice } = useTheme();
  return (
    <div className="seg" role="group" aria-label={t("theme.label")}>
      {THEME_CHOICES.map((c) => (
        <button key={c} type="button" className={`btn sm ${c === choice ? "on" : ""}`} aria-pressed={c === choice} onClick={() => setChoice(c)}>
          {t(LABEL[c])}
        </button>
      ))}
    </div>
  );
}
