import { describe, expect, it } from "vitest";
import { ImportError, LocalStore, MemoryBackend } from "../store";
import type { DriveFiles } from "./drive";
import { syncWithDrive } from "./sync";

/** A Drive with one file in it, as the sync sees it. */
class FakeDrive implements DriveFiles {
  content: string | null = null;
  writes = 0;
  async find() { return this.content === null ? null : "file-1"; }
  async download() { return this.content ?? ""; }
  async create(content: string) { this.content = content; this.writes++; return "file-1"; }
  async update(_id: string, content: string) { this.content = content; this.writes++; }
}

const device = () => new LocalStore(new MemoryBackend());
const watch = (id: string, symbol: string) => ({ id, symbol, note: "", alertAbove: null, alertBelow: null, createdAt: "2026-01-01T00:00:00.000Z" });
const symbols = async (store: LocalStore) => (await store.list("watchlist")).map((w) => w.symbol).sort();

describe("syncWithDrive", () => {
  it("creates the Drive file from a device on the first sync", async () => {
    const drive = new FakeDrive();
    const a = device();
    await a.put("watchlist", watch("w1", "AAA"));

    expect(await syncWithDrive(a, drive)).toEqual({ merged: null, created: true });
    expect(JSON.parse(drive.content ?? "").collections.watchlist).toHaveLength(1);
  });

  it("brings a second device to the first one's data", async () => {
    const drive = new FakeDrive();
    const a = device();
    const b = device();
    await a.put("watchlist", watch("w1", "AAA"));
    await syncWithDrive(a, drive);

    const out = await syncWithDrive(b, drive);

    expect(out.created).toBe(false);
    expect(out.merged?.added).toBe(1);
    expect(await symbols(b)).toEqual(["AAA"]);
  });

  it("converges after edits on both devices, keeping both", async () => {
    const drive = new FakeDrive();
    const a = device();
    const b = device();
    await syncWithDrive(a, drive);
    await syncWithDrive(b, drive);
    await a.put("watchlist", watch("wa", "AAA"));
    await b.put("watchlist", watch("wb", "BBB"));

    await syncWithDrive(a, drive);
    await syncWithDrive(b, drive);
    await syncWithDrive(a, drive);

    expect(await symbols(a)).toEqual(["AAA", "BBB"]);
    expect(await symbols(b)).toEqual(["AAA", "BBB"]);
  });

  it("keeps the later edit of the same record", async () => {
    const drive = new FakeDrive();
    const a = device();
    const b = device();
    await a.put("watchlist", watch("w1", "AAA"));
    await syncWithDrive(a, drive);
    await syncWithDrive(b, drive);
    await a.put("watchlist", { ...watch("w1", "AAA"), note: "older edit" });
    await new Promise((r) => setTimeout(r, 5));
    await b.put("watchlist", { ...watch("w1", "AAA"), note: "newer edit" });

    await syncWithDrive(a, drive);
    await syncWithDrive(b, drive);
    await syncWithDrive(a, drive);

    expect((await a.list("watchlist"))[0]?.note).toBe("newer edit");
    expect((await b.list("watchlist"))[0]?.note).toBe("newer edit");
  });

  it("carries a deletion to the other device", async () => {
    const drive = new FakeDrive();
    const a = device();
    const b = device();
    await a.put("watchlist", watch("w1", "AAA"));
    await syncWithDrive(a, drive);
    await syncWithDrive(b, drive);
    await new Promise((r) => setTimeout(r, 5));
    await b.remove("watchlist", "w1");

    await syncWithDrive(b, drive);
    await syncWithDrive(a, drive);

    expect(await symbols(a)).toEqual([]);
  });

  it("never sends AI settings or their keys to Drive, and ignores any that are on Drive", async () => {
    const drive = new FakeDrive();
    const a = device();
    await a.put("aiSettings", { id: "me", config: { providers: [{ provider: "openai", model: "m", apiKeys: ["sk-secret"] }], ollamaUrl: "" }, favorite: null });
    await a.put("watchlist", watch("w1", "AAA"));
    await syncWithDrive(a, drive);
    expect(drive.content).not.toContain("sk-secret");

    const planted = JSON.parse(drive.content ?? "");
    planted.collections.aiSettings = [{ id: "me", updatedAt: "2099-01-01T00:00:00.000Z", config: { providers: [{ provider: "openai", model: "x", apiKeys: ["from-drive"] }], ollamaUrl: "" }, favorite: null }];
    drive.content = JSON.stringify(planted);
    const b = device();
    await syncWithDrive(b, drive);
    expect(await b.list("aiSettings")).toEqual([]);
    expect(drive.content).not.toContain("from-drive");
  });

  it.each([
    ["not JSON", "this is not json"],
    ["JSON that is not a backup", JSON.stringify({ hello: "world" })],
    ["a backup of another app", JSON.stringify({ app: "other", version: 1, collections: {} })],
  ])("refuses a Drive file that is %s, and writes nothing", async (_name, content) => {
    const drive = new FakeDrive();
    drive.content = content;
    const a = device();
    await a.put("watchlist", watch("w1", "AAA"));

    await expect(syncWithDrive(a, drive)).rejects.toBeInstanceOf(ImportError);
    expect(drive.content).toBe(content);
    expect(drive.writes).toBe(0);
  });
});
