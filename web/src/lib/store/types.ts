/** The user's portfolio data as the app keeps it on the device: records, collections and the store contract. */

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

/** What every stored record carries. `updatedAt` (ISO) is stamped by the store and decides merges. */
export interface StoreRecord {
  readonly id: string;
  readonly updatedAt: string;
}

/** What is left of a deleted record: enough to win a merge, none of its data. */
export interface Tombstone extends StoreRecord {
  readonly deleted: true;
}

export interface AccountRecord extends StoreRecord {
  readonly name: string;
  readonly broker: string;
  readonly currency: string;
  readonly cash: number;
  readonly createdAt: string;
}

export interface HoldingRecord extends StoreRecord {
  readonly accountId: string;
  readonly symbol: string;
  readonly quantity: number;
  readonly avgCost: number;
  readonly openedAt: string;
}

export interface WatchRecord extends StoreRecord {
  readonly symbol: string;
  readonly note: string;
  readonly alertAbove: number | null;
  readonly alertBelow: number | null;
  readonly createdAt: string;
}

export interface NoteRecord extends StoreRecord {
  readonly symbol: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly createdAt: string;
}

/** A PAPI target with MAMI bounds; `symbol` null means the whole portfolio. */
export interface TargetRecord extends StoreRecord {
  readonly name: string;
  readonly symbol: string | null;
  readonly profitTarget: number | null;
  readonly profitMin: number | null;
  readonly profitMax: number | null;
  readonly amountTarget: number | null;
  readonly amountMin: number | null;
  readonly amountMax: number | null;
  readonly periodTargetDays: number | null;
  readonly periodMinDays: number | null;
  readonly periodMaxDays: number | null;
  readonly intent: string;
  readonly intentNote: string;
  readonly riskTarget: number | null;
  readonly riskMin: number | null;
  readonly riskMax: number | null;
  readonly createdAt: string;
}

export interface AlertRecord extends StoreRecord {
  readonly source: string;
  readonly refId: string;
  readonly symbol: string | null;
  readonly message: string;
  readonly dedupeKey: string;
  readonly read: boolean;
  readonly createdAt: string;
}

export interface PlanRecord extends StoreRecord {
  readonly accountId: string;
  readonly symbol: string;
  readonly quantity: number;
  readonly price: number;
  readonly note: string;
  readonly verdict: string;
  readonly check: JsonObject;
  readonly status: string;
  readonly availableAt: string;
  readonly createdAt: string;
  readonly executedHoldingId: string | null;
}

export interface RiskProfileRecord extends StoreRecord {
  readonly level: string;
  readonly answers: JsonObject;
  readonly maxPositionPct: number;
  readonly maxSectorPct: number;
  readonly minSafetyScore: number;
  readonly maxVolatilityPct: number;
  readonly maxDrawdownPct: number;
  readonly minMarketCapM: number;
  readonly allowPennyStocks: boolean;
  readonly coolingOffHours: number;
  readonly paperMode: boolean;
}

export interface AiSettingsRecord extends StoreRecord {
  /** The user's provider list and keys. Stays on the device. */
  readonly config: JsonObject;
  readonly favorite: string | null;
}

export interface RecordMap {
  readonly accounts: AccountRecord;
  readonly holdings: HoldingRecord;
  readonly watchlist: WatchRecord;
  readonly notes: NoteRecord;
  readonly targets: TargetRecord;
  readonly alerts: AlertRecord;
  readonly plans: PlanRecord;
  readonly riskProfile: RiskProfileRecord;
  readonly aiSettings: AiSettingsRecord;
}

export type CollectionName = keyof RecordMap;

export const COLLECTIONS = ["accounts", "holdings", "watchlist", "notes", "targets", "alerts", "plans", "riskProfile", "aiSettings"] as const satisfies readonly CollectionName[];

/** The id of the one record in a single-record collection (`riskProfile`, `aiSettings`). */
export const SINGLETON_ID = "me";

/** What a caller supplies to `put`: a record without the `updatedAt` the store stamps. */
export type NewRecord<K extends CollectionName> = Omit<RecordMap[K], "updatedAt">;

export type Stored<K extends CollectionName> = RecordMap[K] | Tombstone;

/** The file a backup is written to and read from. Tombstones are included so a restore can't resurrect deletions. */
export interface StoreExport {
  readonly app: "moatmine";
  readonly version: 1;
  readonly exportedAt: string;
  readonly collections: { readonly [K in CollectionName]: readonly Stored<K>[] };
}

export type ImportMode = "merge" | "replace";

export interface ImportSummary {
  /** Records that were not here before. */
  readonly added: number;
  /** Records replaced by a newer version, or turned into tombstones. */
  readonly updated: number;
  /** Records the store already had a newer (or equal) version of. */
  readonly kept: number;
}

/**
 * The contract screens depend on. Records are created and changed with `put`, removed with `remove`
 * (which keeps a tombstone, not the data), and never touched through the storage underneath.
 *
 * Merges (`importAll` in "merge" mode, and later sync) keep, per id, the version with the later
 * `updatedAt`; on a tie a tombstone beats a live record, and between two live records the one
 * already here stays.
 */
export interface PortfolioStore {
  /** The live record with this id, or undefined if there is none or it was removed. */
  get<K extends CollectionName>(collection: K, id: string): Promise<RecordMap[K] | undefined>;
  /** Every live record, ordered by id. */
  list<K extends CollectionName>(collection: K): Promise<readonly RecordMap[K][]>;
  /**
   * Creates or replaces the record with `record.id`, stamping `updatedAt`.
   *
   * @throws StoreValidationError when the record does not fit the collection.
   */
  put<K extends CollectionName>(collection: K, record: NewRecord<K>): Promise<RecordMap[K]>;
  /** Removes the record, leaving a tombstone. Removing something that is not there does nothing. */
  remove(collection: CollectionName, id: string): Promise<void>;
  /** Everything, tombstones included, as a backup file's content. */
  exportAll(): Promise<StoreExport>;
  /**
   * Reads a backup. `data` is untrusted and checked in full first: one bad record rejects the whole
   * import and nothing is changed. "replace" swaps the whole store for the backup in one step.
   *
   * @throws ImportError when `data` is not a valid backup.
   */
  importAll(data: unknown, mode: ImportMode): Promise<ImportSummary>;
}

export class StoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A record handed to `put` does not fit its collection. */
export class StoreValidationError extends StoreError {}

/** Something already in storage does not fit its collection: it was changed outside the app, or by a bug. */
export class StoreCorruptError extends StoreError {}

/** A backup file is not valid. `problems` lists the first few reasons. */
export class ImportError extends StoreError {
  constructor(readonly problems: readonly string[]) {
    super(`Not a valid MoatMine backup: ${problems.join("; ")}`);
  }
}

/** The browser has no usable local storage (for example a private window that blocks it). */
export class StoreUnavailableError extends StoreError {}
