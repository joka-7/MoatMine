"use client";

import { useEffect, useState } from "react";
import { runAlertPass } from "@/lib/data/alerts";
import { useI18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";

/** Event the bell listens for, so it reloads after a pass has raised alerts. */
export const ALERTS_CHANGED = "moatmine:alerts-changed";

const LAST_RUN_KEY = "moatmine.alertsRan";
const EVERY_MS = 15 * 60_000;
const MIN_GAP_MS = 10 * 60_000;

function lastRun(): number {
  try {
    return Number(window.localStorage.getItem(LAST_RUN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markRun(): void {
  try {
    window.localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
  } catch {
    // storage blocked: the pass simply runs again on the next open
  }
}

/**
 * With data kept on the device the server worker cannot see it, so the app checks for alerts
 * itself: once when it opens (unless it checked in the last 10 minutes) and every 15 minutes while open.
 */
export default function LocalAlertsRunner() {
  const { t } = useI18n();
  const { on, ready } = useLocalMode();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !on) return;
    let stopped = false;
    const pass = async () => {
      try {
        const out = await runAlertPass();
        markRun();
        if (stopped) return;
        setError(null);
        if (out.created) window.dispatchEvent(new Event(ALERTS_CHANGED));
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
    };
    if (Date.now() - lastRun() >= MIN_GAP_MS) void pass();
    const timer = window.setInterval(() => void pass(), EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [ready, on]);

  if (!error) return null;
  return <div className="err" role="alert" style={{ position: "fixed", insetInlineEnd: 12, bottom: 12, maxWidth: 360, zIndex: 50 }}>{t("dashboard.alerts.passFailed", { error })}</div>;
}
