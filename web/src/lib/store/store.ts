import type { RawRecord, StoreBackend } from "./backend";
import { checkExport, checkStored } from "./validate";
import {
  COLLECTIONS,
  ImportError,
  StoreCorruptError,
  StoreValidationError,
  type CollectionName,
  type ImportMode,
  type ImportSummary,
  type NewRecord,
  type PortfolioStore,
  type RecordMap,
  type Stored,
  type StoreExport,
} from "./types";

/** Whether `incoming` should replace `existing`: later `updatedAt` wins; on a tie a tombstone beats a live record. */
function supersedes(incoming: Stored<CollectionName>, existing: Stored<CollectionName>): boolean {
  const a = Date.parse(incoming.updatedAt);
  const b = Date.parse(existing.updatedAt);
  if (a !== b) return a > b;
  return "deleted" in incoming && !("deleted" in existing);
}

/** The store the app uses: validation, timestamps, tombstones and merging, over any `StoreBackend`. */
export class LocalStore implements PortfolioStore {
  constructor(
    private readonly backend: StoreBackend,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private read<K extends CollectionName>(collection: K, raw: RawRecord): Stored<K> {
    const checked = checkStored(collection, raw);
    if (!checked.ok) throw new StoreCorruptError(`Stored ${collection} record is invalid: ${checked.error}`);
    return checked.value;
  }

  async get<K extends CollectionName>(collection: K, id: string): Promise<RecordMap[K] | undefined> {
    const raw = await this.backend.get(collection, id);
    if (!raw) return undefined;
    const record = this.read(collection, raw);
    return "deleted" in record ? undefined : record;
  }

  async list<K extends CollectionName>(collection: K): Promise<readonly RecordMap[K][]> {
    const live = (await this.backend.getAll(collection))
      .map((raw) => this.read(collection, raw))
      .filter((r): r is RecordMap[K] => !("deleted" in r));
    return live.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  async put<K extends CollectionName>(collection: K, record: NewRecord<K>): Promise<RecordMap[K]> {
    const stamped = { ...record, updatedAt: this.now().toISOString() };
    const checked = checkStored(collection, stamped);
    if (!checked.ok) throw new StoreValidationError(`Cannot save ${collection} record: ${checked.error}`);
    await this.backend.write({ clear: [], put: [{ collection, record: checked.value as unknown as RawRecord }] });
    return checked.value as RecordMap[K];
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    if (!(await this.backend.get(collection, id))) return;
    const tombstone = { id, updatedAt: this.now().toISOString(), deleted: true };
    await this.backend.write({ clear: [], put: [{ collection, record: tombstone }] });
  }

  async exportAll(): Promise<StoreExport> {
    const entries = await Promise.all(
      COLLECTIONS.map(async (c) => [c, (await this.backend.getAll(c)).map((raw) => this.read(c, raw))] as const),
    );
    return {
      app: "moatmine",
      version: 1,
      exportedAt: this.now().toISOString(),
      collections: Object.fromEntries(entries) as unknown as StoreExport["collections"],
    };
  }

  async importAll(data: unknown, mode: ImportMode): Promise<ImportSummary> {
    const checked = checkExport(data);
    if (!checked.ok) throw new ImportError(checked.error.split("; "));
    const incoming = COLLECTIONS.flatMap((collection) =>
      (checked.value.collections[collection] as readonly Stored<CollectionName>[]).map((record) => ({ collection, record })),
    );

    if (mode === "replace") {
      await this.backend.write({ clear: COLLECTIONS, put: incoming.map((i) => ({ ...i, record: i.record as unknown as RawRecord })) });
      return { added: incoming.length, updated: 0, kept: 0 };
    }

    const summary = { added: 0, updated: 0, kept: 0 };
    const toWrite: { collection: CollectionName; record: RawRecord }[] = [];
    for (const { collection, record } of incoming) {
      const existing = await this.backend.get(collection, record.id);
      if (!existing) summary.added++;
      else if (supersedes(record, this.read(collection, existing))) summary.updated++;
      else {
        summary.kept++;
        continue;
      }
      toWrite.push({ collection, record: record as unknown as RawRecord });
    }
    await this.backend.write({ clear: [], put: toWrite });
    return summary;
  }
}
