"use client";

import { useEffect, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";
import { useLocalMode } from "@/lib/localMode";
import { portfolioStore } from "@/lib/store/shared";
import { DriveAuthError, googleDriveFiles } from "@/lib/sync/drive";
import { driveUnavailable, requestDriveAccessToken, type DriveUnavailable } from "@/lib/sync/driveAuth";
import { syncWithDrive } from "@/lib/sync/sync";
import { ImportError } from "@/lib/store";

const LAST_SYNC_KEY = "moatmine.driveSynced";

function lastSync(): string | null {
  try {
    return window.localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/** Optional backup and sync of the on-device data through the user's own Google Drive (its hidden app folder). */
export default function DriveSyncCard() {
  const { t, lang } = useI18n();
  const { on } = useLocalMode();
  const [unavailable, setUnavailable] = useState<DriveUnavailable | null>(null);
  const [synced, setSynced] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUnavailable(driveUnavailable(firebaseAuth().currentUser));
    setSynced(lastSync());
  }, []);

  const run = async () => {
    setBusy(true);
    setStatus("");
    try {
      const store = await portfolioStore();
      let token = await requestDriveAccessToken();
      let out;
      try {
        out = await syncWithDrive(store, googleDriveFiles(token));
      } catch (e) {
        if (!(e instanceof DriveAuthError)) throw e;
        token = await requestDriveAccessToken(); // the token expired or was refused: ask once more
        out = await syncWithDrive(store, googleDriveFiles(token));
      }
      const now = new Date().toISOString();
      try {
        window.localStorage.setItem(LAST_SYNC_KEY, now);
      } catch {
        // storage blocked: the time of the last sync is just not shown
      }
      setSynced(now);
      setStatus(out.created ? t("drive.created") : t("drive.done", { added: out.merged?.added ?? 0, updated: out.merged?.updated ?? 0 }));
    } catch (e) {
      const detail = e instanceof ImportError ? e.problems.join("; ") : (e as Error).message;
      setStatus(t("drive.failed", { error: detail }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>{t("drive.title")}</h2>
      <p className="sub">{t("drive.intro")}</p>
      <p className="sub">{t("drive.privacy")}</p>
      {unavailable !== null ? (
        <p className="sub" role="status">{t(`drive.unavailable.${unavailable}`)}</p>
      ) : (
        <>
          {!on && <p className="sub">{t("drive.needsDevice")}</p>}
          <button className="btn" disabled={busy || !on} onClick={() => void run()}>{t("drive.sync")}</button>
          {synced && <p className="sub" style={{ marginTop: 8 }}>{t("drive.last", { when: new Date(synced).toLocaleString(lang === "he" ? "he-IL" : undefined) })}</p>}
        </>
      )}
      {status && <p className="sub" role="status" style={{ marginTop: 8 }}>{status}</p>}
    </div>
  );
}
