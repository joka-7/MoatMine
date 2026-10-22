import type { RawRecord, StoreBackend, WriteBatch } from "./backend";
import { COLLECTIONS, type CollectionName } from "./types";

/** Records held in memory only: for tests, and as the reference the other backends must behave like. */
export class MemoryBackend implements StoreBackend {
  private readonly data = new Map<CollectionName, Map<string, RawRecord>>(COLLECTIONS.map((c) => [c, new Map()]));

  private collection(name: CollectionName): Map<string, RawRecord> {
    const found = this.data.get(name);
    if (!found) throw new Error(`Unknown collection ${name}`);
    return found;
  }

  async get(collection: CollectionName, id: string): Promise<RawRecord | undefined> {
    const found = this.collection(collection).get(id);
    return found && structuredClone(found);
  }

  async getAll(collection: CollectionName): Promise<readonly RawRecord[]> {
    return [...this.collection(collection).values()].map((r) => structuredClone(r));
  }

  async write(batch: WriteBatch): Promise<void> {
    // look every collection up first so an unknown name fails before anything changes
    const cleared = batch.clear.map((c) => this.collection(c));
    const puts = batch.put.map(({ collection, record }) => [this.collection(collection), structuredClone(record)] as const);
    cleared.forEach((records) => records.clear());
    puts.forEach(([records, record]) => records.set(record.id, record));
  }
}
