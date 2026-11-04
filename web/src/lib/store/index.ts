import { IndexedDbBackend } from "./indexeddb";
import { LocalStore } from "./store";
import type { PortfolioStore } from "./types";

export * from "./types";
export { LocalStore } from "./store";
export { MemoryBackend } from "./memory";
export { IndexedDbBackend } from "./indexeddb";
export type { StoreBackend } from "./backend";

/** A new unique record id. */
export const newId = (): string => crypto.randomUUID();

/**
 * The portfolio store backed by this browser's IndexedDB.
 *
 * @throws StoreUnavailableError when the browser cannot provide it.
 */
export async function openPortfolioStore(): Promise<PortfolioStore> {
  return new LocalStore(await IndexedDbBackend.open());
}
