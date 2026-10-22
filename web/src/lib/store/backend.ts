import type { CollectionName } from "./types";

/** A record as the storage holds it, before `LocalStore` has checked it. */
export type RawRecord = Readonly<Record<string, unknown>> & { readonly id: string };

/** One atomic change: clear whole collections, then write records. Either all of it happens or none. */
export interface WriteBatch {
  readonly clear: readonly CollectionName[];
  readonly put: readonly { readonly collection: CollectionName; readonly record: RawRecord }[];
}

/** Where records physically live. Knows nothing about their shape; `LocalStore` does the checking. */
export interface StoreBackend {
  get(collection: CollectionName, id: string): Promise<RawRecord | undefined>;
  getAll(collection: CollectionName): Promise<readonly RawRecord[]>;
  write(batch: WriteBatch): Promise<void>;
}
