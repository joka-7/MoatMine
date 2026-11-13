import { ImportError, type ImportSummary, type PortfolioStore, type StoreExport } from "../store";
import type { DriveFiles } from "./drive";

export interface SyncResult {
  /** What merging the Drive copy into this device did; null when there was no Drive copy yet. */
  readonly merged: ImportSummary | null;
  /** Whether the Drive file was created by this sync. */
  readonly created: boolean;
}

/**
 * The file as it goes to Drive and as it is read back. AI settings are never part of it: they hold
 * the user's API keys, and the keys should not leave the device, not even for the user's own Drive.
 */
function withoutAiSettings(file: StoreExport): StoreExport {
  return { ...file, collections: { ...file.collections, aiSettings: [] } };
}

/** The Drive copy, read defensively: it could be anything, so only a well-formed export is touched before validation. */
function remoteFile(text: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError(["The file on Drive is not valid JSON."]);
  }
  const collections = typeof parsed === "object" && parsed !== null ? (parsed as { collections?: unknown }).collections : undefined;
  return typeof collections === "object" && collections !== null ? withoutAiSettings(parsed as StoreExport) : parsed;
}

/**
 * Bring this device and the user's Drive copy to the same state: merge the Drive copy into the
 * device (per record, the later `updatedAt` wins and a deletion beats an edit at the same instant),
 * then write the merged result back to Drive.
 *
 * It is a read-merge-write, not a transaction: two devices syncing at the very same moment can each
 * miss the other's newest edit until their next sync; nothing is lost from either device.
 *
 * @throws ImportError when the Drive file is not a valid MoatMine backup; nothing is written then.
 * @throws DriveError when Drive refuses a request (DriveAuthError when the sign-in has expired).
 */
export async function syncWithDrive(store: PortfolioStore, drive: DriveFiles): Promise<SyncResult> {
  const id = await drive.find();
  let merged: ImportSummary | null = null;
  if (id !== null) {
    merged = await store.importAll(remoteFile(await drive.download(id)), "merge");
  }
  const content = JSON.stringify(withoutAiSettings(await store.exportAll()));
  if (id === null) {
    await drive.create(content);
    return { merged, created: true };
  }
  await drive.update(id, content);
  return { merged, created: false };
}
