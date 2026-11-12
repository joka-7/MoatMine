"use client";

import { useState } from "react";
import { copyToDevice, deleteServerData, fetchServerData, planMove, type MovePlan, type ServerData } from "@/lib/data/migrate";
import { useI18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { ImportError } from "@/lib/store";
import { portfolioStore } from "@/lib/store/shared";

type Step = "idle" | "loaded" | "copied" | "deleted";

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Moves the user's server-side data to the device: look, back up, copy and check, then delete the server copy. */
export default function MoveDataCard() {
  const { t } = useI18n();
  const { choose } = useLocalMode();
  const [step, setStep] = useState<Step>("idle");
  const [server, setServer] = useState<ServerData | null>(null);
  const [plan, setPlan] = useState<MovePlan | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const guarded = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      const detail = e instanceof ImportError ? e.problems.join("; ") : (e as Error).message;
      setStatus(t("move.failed", { error: detail }));
    } finally {
      setBusy(false);
    }
  };

  const load = () => guarded(async () => {
    const data = await fetchServerData();
    setServer(data);
    setPlan(planMove(data, new Date()));
    setStep("loaded");
    setStatus("");
  });

  const backup = () => {
    if (!server) return;
    download(`moatmine-server-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(server, null, 2));
    setBackedUp(true);
  };

  const copy = () => guarded(async () => {
    if (!plan) return;
    const { missing } = await copyToDevice(await portfolioStore(), plan);
    if (missing.length) {
      setStatus(t("move.missing", { count: missing.length }));
      return;
    }
    choose(true);
    setStep("copied");
    setStatus(t("move.copied", { count: Object.values(plan.counts).reduce((a, b) => a + b, 0) }));
  });

  const remove = () => guarded(async () => {
    const counts = await deleteServerData();
    setStep("deleted");
    setStatus(t("move.deleted", { rows: Object.values(counts).reduce((a, b) => a + b, 0) }));
  });

  const c = plan?.counts;
  return (
    <div className="card">
      <h2>{t("move.title")}</h2>
      <p className="sub">{t("move.intro")}</p>
      {step === "idle" && <button className="btn" disabled={busy} onClick={load}>{t("move.start")}</button>}
      {plan && c && step !== "deleted" && (
        <div className="grid" style={{ gap: 8 }}>
          <p className="sub" style={{ margin: 0 }}>
            {t("move.summary", { accounts: server?.accounts.length ?? 0, holdings: server?.holdings.length ?? 0, watchlist: c.watchlist, notes: c.notes, targets: c.targets, alerts: c.alerts, plans: server?.plans.length ?? 0 })}
          </p>
          {(plan.leftBehind.accounts > 0 || plan.leftBehind.holdings > 0 || plan.leftBehind.plans > 0) && (
            <p className="sub" style={{ margin: 0 }}>{t("move.leftBehind", plan.leftBehind)}</p>
          )}
          <div className="row">
            <button className="btn" onClick={backup}>{t("move.backup")}</button>
            <button className="btn primary" disabled={busy || step === "copied"} onClick={copy}>{t("move.copy")}</button>
          </div>
        </div>
      )}
      {step === "copied" && (
        <div className="grid" style={{ gap: 8, marginTop: 10 }}>
          <label className="row" style={{ alignItems: "flex-start", gap: 8 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            {t("move.confirm")}
          </label>
          <button className="btn" disabled={busy || !confirmed || !backedUp} onClick={remove}>{t("move.delete")}</button>
        </div>
      )}
      {status && <p className="sub" role="status" style={{ marginTop: 8 }}>{status}</p>}
    </div>
  );
}
