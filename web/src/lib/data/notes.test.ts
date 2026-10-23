import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { addNote, listNotes, removeNote } from "./notes";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
const mockedApi = vi.mocked(api);

const input = (title: string) => ({ kind: "note", title, body: "b", url: "" });

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  mockedApi.mockReset();
  window.localStorage.clear();
});

describe("addNote", () => {
  it("posts to the server when local mode is off", async () => {
    await addNote("AAPL", input("t"));
    expect(mockedApi).toHaveBeenCalledWith("/stocks/AAPL/notes", { method: "POST", json: input("t") });
  });

  it("keeps the note on the device, with no server call, when local mode is on", async () => {
    setLocalMode(true);
    await addNote("AAPL", input("t"));
    expect(mockedApi).not.toHaveBeenCalled();
    expect(await store.list("notes")).toMatchObject([{ symbol: "AAPL", title: "t", body: "b" }]);
  });
});

describe("listNotes", () => {
  it("reads from the server when not local", async () => {
    mockedApi.mockResolvedValueOnce([{ id: 1 }]);
    expect(await listNotes("AAPL", false)).toEqual([{ id: 1 }]);
  });

  it("returns only that symbol's local notes, newest first, in the server's shape", async () => {
    setLocalMode(true);
    await store.put("notes", { id: "old", symbol: "AAPL", ...input("old"), createdAt: "2024-01-01T00:00:00.000Z" });
    await store.put("notes", { id: "new", symbol: "AAPL", ...input("new"), createdAt: "2024-02-01T00:00:00.000Z" });
    await store.put("notes", { id: "other", symbol: "MSFT", ...input("other"), createdAt: "2024-03-01T00:00:00.000Z" });
    const notes = await listNotes("AAPL", true);
    expect(notes.map((n) => n.title)).toEqual(["new", "old"]);
    expect(notes[0]).toMatchObject({ id: "new", symbol: "AAPL", created_at: "2024-02-01T00:00:00.000Z" });
  });
});

describe("removeNote", () => {
  it("deletes on the server when local mode is off", async () => {
    await removeNote("AAPL", 3);
    expect(mockedApi).toHaveBeenCalledWith("/stocks/AAPL/notes/3", { method: "DELETE" });
  });

  it("removes the local note when local mode is on", async () => {
    setLocalMode(true);
    await addNote("AAPL", input("t"));
    const [n] = await store.list("notes");
    if (!n) throw new Error("expected a record");
    await removeNote("AAPL", n.id);
    expect(await store.list("notes")).toEqual([]);
  });
});
