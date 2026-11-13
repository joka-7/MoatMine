/** The one file the app keeps in the user's hidden Drive app folder (`appDataFolder`, scope `drive.appdata`). */
export const SYNC_FILE_NAME = "moatmine-data.json";

/** Where the access token comes from is not this module's business: it only needs a current one. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export class DriveError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** The access token was refused or has expired: ask the user to sign in to Drive again. */
export class DriveAuthError extends DriveError {}

/** What the sync needs from Drive; tests use an in-memory fake. */
export interface DriveFiles {
  /** The sync file's id, or null if it has not been created yet. */
  find(): Promise<string | null>;
  download(id: string): Promise<string>;
  /** Creates the file and returns its id. */
  create(content: string): Promise<string>;
  update(id: string, content: string): Promise<void>;
}

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  const detail = await res.text().catch(() => "");
  const message = `Google Drive answered ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`;
  throw res.status === 401 || res.status === 403 ? new DriveAuthError(res.status, message) : new DriveError(res.status, message);
}

/** Drive's REST API over `fetch`, with the user's own access token. */
export function googleDriveFiles(accessToken: string, fetchFn: typeof fetch = fetch): DriveFiles {
  const headers = { Authorization: `Bearer ${accessToken}` };
  return {
    async find() {
      const q = encodeURIComponent(`name='${SYNC_FILE_NAME}'`);
      const res = await check(await fetchFn(`${API}?spaces=appDataFolder&q=${q}&fields=files(id)&pageSize=1`, { headers }));
      const body = (await res.json()) as { files?: { id: string }[] };
      return body.files?.[0]?.id ?? null;
    },
    async download(id) {
      return (await check(await fetchFn(`${API}/${encodeURIComponent(id)}?alt=media`, { headers }))).text();
    },
    async create(content) {
      const boundary = `moatmine-${Math.random().toString(36).slice(2)}`;
      const metadata = JSON.stringify({ name: SYNC_FILE_NAME, parents: ["appDataFolder"] });
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
      const res = await check(await fetchFn(`${UPLOAD}?uploadType=multipart&fields=id`, {
        method: "POST", headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
      }));
      return ((await res.json()) as { id: string }).id;
    },
    async update(id, content) {
      await check(await fetchFn(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=media`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: content,
      }));
    },
  };
}
