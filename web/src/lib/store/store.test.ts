import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { RawRecord, StoreBackend } from "./backend";
import { IndexedDbBackend } from "./indexeddb";
import { MemoryBackend } from "./memory";
import { LocalStore } from "./store";
import { sample } from "./testing";
import { COLLECTIONS, ImportError, StoreCorruptError, StoreValidationError, type StoreExport } from "./types";

// The same behaviour is required of every backend, so each suite below runs over all of them.
const BACKENDS: readonly [string, () => Promise<StoreBackend>][] = [
  ["memory", async () => new MemoryBackend()],
  ["IndexedDB", () => IndexedDbBackend.open(new IDBFactory())],
];

const T1 = new Date("2024-02-01T00:00:00.000Z");
const T2 = new Date("2024-03-01T00:00:00.000Z");
const T3 = new Date("2024-04-01T00:00:00.000Z");

describe.each(BACKENDS)("LocalStore over %s", (_, open) => {
  let backend: StoreBackend;
  let clock: Date;
  let store: LocalStore;

  beforeEach(async () => {
    backend = await open();
    clock = T1;
    store = new LocalStore(backend, () => clock);
  });

  const backupOf = (changes: Partial<Record<(typeof COLLECTIONS)[number], unknown[]>> = {}) => ({
    app: "moatmine",
    version: 1,
    exportedAt: T1.toISOString(),
    collections: { ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])), ...changes },
  });
  const live = (id: string, at: Date, changes = {}) => ({ ...sample("accounts", id, changes), updatedAt: at.toISOString() });
  const dead = (id: string, at: Date) => ({ id, updatedAt: at.toISOString(), deleted: true });

  describe("put", () => {
    it("stamps updatedAt from the clock and stores the record", async () => {
      const saved = await store.put("accounts", sample("accounts", "a1"));
      expect(saved).toEqual({ ...sample("accounts", "a1"), updatedAt: T1.toISOString() });
      expect(await store.get("accounts", "a1")).toEqual(saved);
    });

    it("replaces the record with the same id and restamps it", async () => {
      await store.put("accounts", sample("accounts", "a1", { cash: 1 }));
      clock = T2;
      await store.put("accounts", sample("accounts", "a1", { cash: 2 }));
      expect(await store.list("accounts")).toEqual([{ ...sample("accounts", "a1", { cash: 2 }), updatedAt: T2.toISOString() }]);
    });

    it("keeps collections apart even when ids repeat", async () => {
      await store.put("accounts", sample("accounts", "x"));
      await store.put("notes", sample("notes", "x"));
      expect(await store.list("accounts")).toHaveLength(1);
      expect((await store.list("notes"))[0]).toMatchObject({ title: "Why" });
    });

    it.each([
      ["a number that is a string", { cash: "5" }],
      ["a missing name", { name: undefined }],
      ["a bad date", { createdAt: "later" }],
    ])("refuses a record with %s and stores nothing", async (_label, changes) => {
      await expect(store.put("accounts", sample("accounts", "a1", changes as never))).rejects.toBeInstanceOf(StoreValidationError);
      expect(await store.list("accounts")).toEqual([]);
    });

    it("refuses an empty id", async () => {
      await expect(store.put("accounts", sample("accounts", ""))).rejects.toBeInstanceOf(StoreValidationError);
    });
  });

  describe("get and list", () => {
    it("get gives undefined for an unknown id and for a removed record", async () => {
      await store.put("holdings", sample("holdings", "h1"));
      await store.remove("holdings", "h1");
      expect(await store.get("holdings", "h1")).toBeUndefined();
      expect(await store.get("holdings", "nope")).toBeUndefined();
    });

    it("list is ordered by id and leaves out removed records", async () => {
      for (const id of ["b", "c", "a"]) await store.put("watchlist", sample("watchlist", id));
      await store.remove("watchlist", "c");
      expect((await store.list("watchlist")).map((r) => r.id)).toEqual(["a", "b"]);
    });

    it("list of an empty collection is empty", async () => {
      expect(await store.list("plans")).toEqual([]);
    });

    it.each([
      ["get", (s: LocalStore) => s.get("accounts", "bad")],
      ["list", (s: LocalStore) => s.list("accounts")],
      ["exportAll", (s: LocalStore) => s.exportAll()],
    ])("%s refuses a record that was damaged in storage instead of passing it on", async (_label, act) => {
      await backend.write({ clear: [], put: [{ collection: "accounts", record: { id: "bad", updatedAt: T1.toISOString(), name: 5 } as RawRecord }] });
      await expect(act(store)).rejects.toBeInstanceOf(StoreCorruptError);
    });
  });

  describe("remove", () => {
    it("leaves a tombstone with none of the data", async () => {
      await store.put("notes", sample("notes", "n1"));
      clock = T2;
      await store.remove("notes", "n1");
      expect((await store.exportAll()).collections.notes).toEqual([{ id: "n1", updatedAt: T2.toISOString(), deleted: true }]);
    });

    it("does nothing for a record that is not there", async () => {
      await store.remove("notes", "ghost");
      expect((await store.exportAll()).collections.notes).toEqual([]);
    });

    it("lets a later put bring the id back", async () => {
      await store.put("notes", sample("notes", "n1"));
      await store.remove("notes", "n1");
      clock = T2;
      await store.put("notes", sample("notes", "n1", { title: "Again" }));
      expect(await store.get("notes", "n1")).toMatchObject({ title: "Again", updatedAt: T2.toISOString() });
    });
  });

  describe("exportAll", () => {
    it("has every collection, live records and tombstones, and says when it was made", async () => {
      await store.put("accounts", sample("accounts", "a1"));
      await store.put("riskProfile", sample("riskProfile", "me"));
      await store.put("alerts", sample("alerts", "x"));
      await store.remove("alerts", "x");
      clock = T3;
      const out = await store.exportAll();
      expect(out).toMatchObject({ app: "moatmine", version: 1, exportedAt: T3.toISOString() });
      expect(Object.keys(out.collections).sort()).toEqual([...COLLECTIONS].sort());
      expect(out.collections.accounts).toHaveLength(1);
      expect(out.collections.riskProfile).toHaveLength(1);
      expect(out.collections.alerts).toEqual([{ id: "x", updatedAt: T1.toISOString(), deleted: true }]);
    });

    it("survives a trip through JSON into an empty store unchanged", async () => {
      for (const c of COLLECTIONS) await store.put(c, sample(c, "r1") as never);
      await store.remove("notes", "r1");
      const file = JSON.parse(JSON.stringify(await store.exportAll())) as StoreExport;

      const other = new LocalStore(await open(), () => clock);
      await other.importAll(file, "replace");
      expect((await other.exportAll()).collections).toEqual(file.collections);
    });
  });

  describe("importAll", () => {
    it("in replace mode swaps the whole store for the backup, dropping what was there", async () => {
      await store.put("accounts", sample("accounts", "old"));
      await store.put("notes", sample("notes", "gone"));
      const summary = await store.importAll(backupOf({ accounts: [live("new", T2)] }), "replace");
      expect(summary).toEqual({ added: 1, updated: 0, kept: 0 });
      expect((await store.list("accounts")).map((r) => r.id)).toEqual(["new"]);
      expect(await store.list("notes")).toEqual([]);
    });

    it.each<[string, unknown, Date, Date | "dead", "added" | "updated" | "kept", string | null]>([
      // [case, existing, ...] expressed below as: existing at `have`, incoming at `get` -> outcome, and which cash survives
      ["a record it does not have", null, T1, T1, "added", "incoming"],
      ["a newer version", "live", T1, T2, "updated", "incoming"],
      ["an older version", "live", T2, T1, "kept", "existing"],
      ["the same version", "live", T2, T2, "kept", "existing"],
      ["a tombstone at the same time", "live", T2, "dead", "updated", null],
      ["a newer tombstone", "live", T1, "dead", "updated", null],
    ])("in merge mode handles %s", async (_label, existing, have, get, outcome, survivor) => {
      if (existing) await backend.write({ clear: [], put: [{ collection: "accounts", record: live("a1", have, { cash: 1 }) as RawRecord }] });
      const incoming = get === "dead" ? dead("a1", have.getTime() === T1.getTime() ? T2 : have) : live("a1", get, { cash: 2 });
      expect(await store.importAll(backupOf({ accounts: [incoming] }), "merge")).toMatchObject({ [outcome]: 1 });
      const now = await store.get("accounts", "a1");
      if (survivor === null) expect(now).toBeUndefined();
      else expect(now?.cash).toBe(survivor === "incoming" ? 2 : 1);
    });

    it("keeps its own newer deletion when the backup still has the record", async () => {
      await store.put("accounts", sample("accounts", "a1"));
      clock = T3;
      await store.remove("accounts", "a1");
      await store.importAll(backupOf({ accounts: [live("a1", T2)] }), "merge");
      expect(await store.get("accounts", "a1")).toBeUndefined();
    });

    it("counts a mixed backup", async () => {
      await store.put("accounts", sample("accounts", "same"));
      const summary = await store.importAll(backupOf({ accounts: [live("same", T1), live("fresh", T2)] }), "merge");
      expect(summary).toEqual({ added: 1, updated: 0, kept: 1 });
    });

    it.each<[string, unknown]>([
      ["not a backup", { hello: "world" }],
      ["one bad record among good ones", backupOf({ accounts: [live("ok", T2), { id: "bad", updatedAt: T2.toISOString(), name: 1 }] })],
      ["the same id twice", backupOf({ accounts: [live("a", T2), live("a", T2)] })],
      ["a future version", { ...backupOf(), version: 9 }],
    ])("rejects %s and changes nothing, in either mode", async (_label, data) => {
      await store.put("accounts", sample("accounts", "keep"));
      for (const mode of ["merge", "replace"] as const) {
        await expect(store.importAll(data, mode)).rejects.toBeInstanceOf(ImportError);
      }
      expect((await store.list("accounts")).map((r) => r.id)).toEqual(["keep"]);
    });

    it("names the problems in the error", async () => {
      const error = await store.importAll({ ...backupOf(), collections: { ...backupOf().collections, accounts: [{ id: "a1" }] } }, "merge").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ImportError);
      expect((error as ImportError).problems[0]).toMatch(/accounts\[0\]/);
    });
  });
});
