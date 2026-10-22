import { COLLECTIONS, type CollectionName, type RecordMap, type Stored, type StoreExport, type StoreRecord } from "./types";

// Everything read from storage or from a backup file is untrusted until it has passed through here.
// A record is rebuilt from its known fields only, so nothing unexpected is carried into the store.

type Kind = "string" | "number" | "boolean" | "iso" | "stringOrNull" | "numberOrNull" | "object";

/** One kind per field a record has beyond `id` and `updatedAt`; the compiler keeps this in step with the record types. */
type Spec<T> = { readonly [F in Exclude<keyof T, keyof StoreRecord>]-?: Kind };

const SPECS = {
  accounts: { name: "string", broker: "string", currency: "string", cash: "number", createdAt: "iso" },
  holdings: { accountId: "string", symbol: "string", quantity: "number", avgCost: "number", openedAt: "iso" },
  watchlist: { symbol: "string", note: "string", alertAbove: "numberOrNull", alertBelow: "numberOrNull", createdAt: "iso" },
  notes: { symbol: "string", kind: "string", title: "string", body: "string", url: "string", createdAt: "iso" },
  targets: {
    name: "string", symbol: "stringOrNull",
    profitTarget: "numberOrNull", profitMin: "numberOrNull", profitMax: "numberOrNull",
    amountTarget: "numberOrNull", amountMin: "numberOrNull", amountMax: "numberOrNull",
    periodTargetDays: "numberOrNull", periodMinDays: "numberOrNull", periodMaxDays: "numberOrNull",
    intent: "string", intentNote: "string", riskTarget: "numberOrNull", riskMin: "numberOrNull", riskMax: "numberOrNull",
    createdAt: "iso",
  },
  alerts: { source: "string", refId: "string", symbol: "stringOrNull", message: "string", dedupeKey: "string", read: "boolean", createdAt: "iso" },
  plans: {
    accountId: "string", symbol: "string", quantity: "number", price: "number", note: "string", verdict: "string",
    check: "object", status: "string", availableAt: "iso", createdAt: "iso", executedHoldingId: "stringOrNull",
  },
  riskProfile: {
    level: "string", answers: "object", maxPositionPct: "number", maxSectorPct: "number", minSafetyScore: "number",
    maxVolatilityPct: "number", maxDrawdownPct: "number", minMarketCapM: "number", allowPennyStocks: "boolean",
    coolingOffHours: "number", paperMode: "boolean",
  },
  aiSettings: { config: "object", favorite: "stringOrNull" },
} as const satisfies { readonly [K in CollectionName]: Spec<RecordMap[K]> };

const MAX_ID_LENGTH = 200;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const KIND_CHECKS: { readonly [K in Kind]: (v: unknown) => boolean } = {
  string: (v) => typeof v === "string",
  number: isNumber,
  boolean: (v) => typeof v === "boolean",
  iso: isIso,
  stringOrNull: (v) => v === null || typeof v === "string",
  numberOrNull: (v) => v === null || isNumber(v),
  object: isPlainObject,
};

export type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/** A copy of `value` as a stored record of `collection` (a live record or a tombstone), or why it isn't one. */
export function checkStored<K extends CollectionName>(collection: K, value: unknown): Checked<Stored<K>> {
  if (!isPlainObject(value)) return { ok: false, error: "not an object" };
  const { id, updatedAt } = value;
  if (typeof id !== "string" || id === "" || id.length > MAX_ID_LENGTH) return { ok: false, error: "id is missing or not a short string" };
  if (!isIso(updatedAt)) return { ok: false, error: `${id}: updatedAt is not a date` };
  if (value.deleted === true) return { ok: true, value: { id, updatedAt, deleted: true } };

  const copy: Record<string, unknown> = { id, updatedAt };
  for (const [field, kind] of Object.entries<Kind>(SPECS[collection])) {
    if (!KIND_CHECKS[kind](value[field])) return { ok: false, error: `${id}: ${field} should be ${kind}` };
    copy[field] = value[field];
  }
  return { ok: true, value: copy as unknown as Stored<K> };
}

/** The `collections` of a backup, checked record by record. Reports at most `limit` problems. */
export function checkExport(data: unknown, limit = 5): Checked<StoreExport> {
  const problems: string[] = [];
  const note = (message: string) => {
    if (problems.length < limit) problems.push(message);
  };
  if (!isPlainObject(data) || data.app !== "moatmine") return { ok: false, error: "this is not a MoatMine backup" };
  if (data.version !== 1) return { ok: false, error: `backup version ${String(data.version)} is not supported` };
  if (!isIso(data.exportedAt)) note("exportedAt is not a date");
  const collections = isPlainObject(data.collections) ? data.collections : null;
  if (!collections) return { ok: false, error: "the backup has no collections" };

  const clean: Record<string, readonly Stored<CollectionName>[]> = {};
  for (const name of COLLECTIONS) {
    const records = collections[name];
    if (!Array.isArray(records)) {
      note(`${name} is missing or not a list`);
      continue;
    }
    const ids = new Set<string>();
    clean[name] = records.flatMap((raw: unknown, index) => {
      const checked = checkStored(name, raw);
      if (!checked.ok) {
        note(`${name}[${index}]: ${checked.error}`);
        return [];
      }
      if (ids.has(checked.value.id)) note(`${name}: id ${checked.value.id} appears twice`);
      ids.add(checked.value.id);
      return [checked.value];
    });
  }
  if (problems.length > 0) return { ok: false, error: problems.join("; ") };
  return { ok: true, value: { app: "moatmine", version: 1, exportedAt: data.exportedAt as string, collections: clean as unknown as StoreExport["collections"] } };
}
