import { api, Note } from "../api";
import { isLocalMode } from "../localMode";
import { newId } from "../store";
import { portfolioStore } from "../store/shared";
import type { NoteRecord } from "../store";

export interface NoteInput {
  kind: string;
  title: string;
  body: string;
  url: string;
}

/** Notes on one symbol, newest first: from this device in local mode, else from the server. */
export async function listNotes(symbol: string, local: boolean): Promise<Note[]> {
  if (!local) return api<Note[]>(`/stocks/${symbol}/notes`);
  const records = await (await portfolioStore()).list("notes");
  return records
    .filter((n) => n.symbol === symbol)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((n) => ({ id: n.id, symbol: n.symbol, kind: n.kind as Note["kind"], title: n.title, body: n.body, url: n.url, created_at: n.createdAt }));
}

export async function addNote(symbol: string, input: NoteInput): Promise<void> {
  if (!isLocalMode()) {
    await api(`/stocks/${symbol}/notes`, { method: "POST", json: input });
    return;
  }
  const record: Omit<NoteRecord, "updatedAt"> = { id: newId(), symbol, ...input, createdAt: new Date().toISOString() };
  await (await portfolioStore()).put("notes", record);
}

export async function removeNote(symbol: string, id: number | string): Promise<void> {
  if (isLocalMode()) await (await portfolioStore()).remove("notes", String(id));
  else await api(`/stocks/${symbol}/notes/${id}`, { method: "DELETE" });
}
