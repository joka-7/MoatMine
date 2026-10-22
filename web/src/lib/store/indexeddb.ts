import type { RawRecord, StoreBackend, WriteBatch } from "./backend";
import { COLLECTIONS, StoreUnavailableError, type CollectionName } from "./types";

const DB_NAME = "moatmine";
const DB_VERSION = 1;

const settled = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });

/** Records in the browser's IndexedDB: one object store per collection, keyed by id. */
export class IndexedDbBackend implements StoreBackend {
  private constructor(private readonly db: IDBDatabase) {}

  /**
   * Opens (creating on first use) the database.
   *
   * @throws StoreUnavailableError when IndexedDB is missing or refuses to open (some private windows).
   */
  static async open(factory: IDBFactory | undefined = globalThis.indexedDB, name = DB_NAME): Promise<IndexedDbBackend> {
    if (!factory) throw new StoreUnavailableError("This browser has no IndexedDB.");
    try {
      const request = factory.open(name, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const collection of COLLECTIONS) {
          if (!request.result.objectStoreNames.contains(collection)) request.result.createObjectStore(collection, { keyPath: "id" });
        }
      };
      return new IndexedDbBackend(await settled(request));
    } catch (e) {
      throw new StoreUnavailableError("Local storage could not be opened.", { cause: e });
    }
  }

  close(): void {
    this.db.close();
  }

  async get(collection: CollectionName, id: string): Promise<RawRecord | undefined> {
    const tx = this.db.transaction(collection, "readonly");
    return (await settled(tx.objectStore(collection).get(id))) as RawRecord | undefined;
  }

  async getAll(collection: CollectionName): Promise<readonly RawRecord[]> {
    const tx = this.db.transaction(collection, "readonly");
    return (await settled(tx.objectStore(collection).getAll())) as RawRecord[];
  }

  async write(batch: WriteBatch): Promise<void> {
    const names = [...new Set([...batch.clear, ...batch.put.map((p) => p.collection)])];
    if (names.length === 0) return;
    const tx = this.db.transaction(names, "readwrite");
    try {
      batch.clear.forEach((c) => tx.objectStore(c).clear());
      batch.put.forEach(({ collection, record }) => tx.objectStore(collection).put(record));
    } catch (e) {
      tx.abort(); // an open transaction would otherwise commit the part that already ran
      throw e;
    }
    await finished(tx);
  }
}
