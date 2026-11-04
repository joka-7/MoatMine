import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { IndexedDbBackend } from "./indexeddb";
import { COLLECTIONS, StoreUnavailableError } from "./types";

const record = (id: string, name = "n") => ({ id, updatedAt: "2024-01-01T00:00:00.000Z", name });

describe("IndexedDbBackend", () => {
  it("creates one store per collection on first use", async () => {
    const factory = new IDBFactory();
    (await IndexedDbBackend.open(factory)).close();
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open("moatmine");
      request.onsuccess = () => resolve(request.result);
    });
    expect([...db.objectStoreNames].sort()).toEqual([...COLLECTIONS].sort());
    db.close();
  });

  it("keeps what was written after it is closed and opened again", async () => {
    const factory = new IDBFactory();
    const first = await IndexedDbBackend.open(factory);
    await first.write({ clear: [], put: [{ collection: "accounts", record: record("a1") }] });
    first.close();
    const second = await IndexedDbBackend.open(factory);
    expect(await second.get("accounts", "a1")).toEqual(record("a1"));
    expect(await second.getAll("accounts")).toHaveLength(1);
  });

  it("writes a batch in one step: clearing and writing across collections", async () => {
    const backend = await IndexedDbBackend.open(new IDBFactory());
    await backend.write({ clear: [], put: [{ collection: "accounts", record: record("old") }, { collection: "notes", record: record("n") }] });
    await backend.write({ clear: ["accounts", "notes"], put: [{ collection: "accounts", record: record("new") }] });
    expect((await backend.getAll("accounts")).map((r) => r.id)).toEqual(["new"]);
    expect(await backend.getAll("notes")).toEqual([]);
  });

  it("undoes the whole batch when part of it fails, so a bad import cannot half-replace the data", async () => {
    const backend = await IndexedDbBackend.open(new IDBFactory());
    await backend.write({ clear: [], put: [{ collection: "accounts", record: record("keep") }] });
    // a record without a key cannot be stored: the clear before it must not survive
    const broken = { updatedAt: "x" } as unknown as ReturnType<typeof record>;
    await expect(backend.write({ clear: ["accounts"], put: [{ collection: "accounts", record: broken }] })).rejects.toThrow();
    expect((await backend.getAll("accounts")).map((r) => r.id)).toEqual(["keep"]);
  });

  it("does nothing for an empty batch", async () => {
    const backend = await IndexedDbBackend.open(new IDBFactory());
    await expect(backend.write({ clear: [], put: [] })).resolves.toBeUndefined();
  });

  it("returns undefined for an id it does not have", async () => {
    expect(await (await IndexedDbBackend.open(new IDBFactory())).get("accounts", "nope")).toBeUndefined();
  });

  it.each([
    ["there is no IndexedDB", undefined],
    [
      "opening fails",
      {
        open: () => {
          const request = {} as IDBOpenDBRequest;
          queueMicrotask(() => Object.assign(request, { error: new DOMException("blocked", "SecurityError") }).onerror?.(new Event("error")));
          return request;
        },
      } as unknown as IDBFactory,
    ],
    ["the factory throws", { open: vi.fn(() => { throw new DOMException("denied", "SecurityError"); }) } as unknown as IDBFactory],
  ])("says the store is unavailable when %s", async (_label, factory) => {
    await expect(IndexedDbBackend.open(factory ?? (undefined as unknown as IDBFactory), "x")).rejects.toBeInstanceOf(StoreUnavailableError);
  });
});
