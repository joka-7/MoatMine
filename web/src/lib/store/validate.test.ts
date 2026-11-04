import { describe, expect, it } from "vitest";
import { sample } from "./testing";
import { COLLECTIONS, type CollectionName } from "./types";
import { checkExport, checkStored } from "./validate";

const AT = "2024-01-01T00:00:00.000Z";

describe("checkStored", () => {
  it.each(COLLECTIONS)("accepts a valid %s record and keeps its fields", (collection) => {
    const record = { ...sample(collection, "r1"), updatedAt: AT };
    const checked = checkStored(collection, record);
    expect(checked).toEqual({ ok: true, value: record });
  });

  it("keeps only known fields, so nothing unexpected reaches the store", () => {
    const checked = checkStored("accounts", { ...sample("accounts", "a1"), updatedAt: AT, extra: "x", __proto__: { evil: 1 } });
    expect(checked.ok && "extra" in checked.value).toBe(false);
  });

  it("turns a deleted record into a bare tombstone", () => {
    const checked = checkStored("holdings", { ...sample("holdings", "h1"), updatedAt: AT, deleted: true });
    expect(checked).toEqual({ ok: true, value: { id: "h1", updatedAt: AT, deleted: true } });
  });

  it.each<[string, CollectionName, Record<string, unknown>, RegExp]>([
    ["no id", "accounts", { id: undefined }, /id/],
    ["an empty id", "accounts", { id: "" }, /id/],
    ["an id that is not a string", "accounts", { id: 5 }, /id/],
    ["an id that is far too long", "accounts", { id: "x".repeat(201) }, /id/],
    ["a bad updatedAt", "accounts", { updatedAt: "yesterday" }, /updatedAt/],
    ["a missing field", "accounts", { name: undefined }, /name should be string/],
    ["a number that is a string", "accounts", { cash: "100" }, /cash should be number/],
    ["a number that is not finite", "accounts", { cash: Number.NaN }, /cash should be number/],
    ["an infinite number", "holdings", { quantity: Infinity }, /quantity/],
    ["undefined where null is allowed", "watchlist", { alertAbove: undefined }, /alertAbove should be numberOrNull/],
    ["a string where a number or null is allowed", "watchlist", { alertBelow: "300" }, /alertBelow/],
    ["a bad date field", "notes", { createdAt: "soon" }, /createdAt should be iso/],
    ["a boolean that is a string", "alerts", { read: "false" }, /read should be boolean/],
    ["an array where an object belongs", "plans", { check: [] }, /check should be object/],
    ["null where an object belongs", "aiSettings", { config: null }, /config should be object/],
  ])("rejects %s", (_, collection, changes, message) => {
    const checked = checkStored(collection, { ...sample(collection, "r1"), updatedAt: AT, ...changes });
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.error).toMatch(message);
  });

  it.each([[null], ["text"], [42], [[]]])("rejects %j, which is not an object", (value) => {
    expect(checkStored("accounts", value).ok).toBe(false);
  });
});

describe("checkExport", () => {
  const empty = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  const backup = (changes: Record<string, unknown> = {}) => ({ app: "moatmine", version: 1, exportedAt: AT, collections: empty, ...changes });

  it("accepts an empty backup and a backup with records and tombstones", () => {
    expect(checkExport(backup()).ok).toBe(true);
    const full = backup({
      collections: { ...empty, accounts: [{ ...sample("accounts", "a1"), updatedAt: AT }, { id: "a2", updatedAt: AT, deleted: true }] },
    });
    const checked = checkExport(full);
    expect(checked.ok && checked.value.collections.accounts).toHaveLength(2);
  });

  it.each<[string, unknown, RegExp]>([
    ["something that is not an object", "nope", /not a MoatMine backup/],
    ["another app's file", { app: "other", version: 1 }, /not a MoatMine backup/],
    ["a future version", backup({ version: 2 }), /version 2 is not supported/],
    ["no collections", backup({ collections: undefined }), /no collections/],
    ["a bad exportedAt", backup({ exportedAt: "x" }), /exportedAt/],
    ["a missing collection", backup({ collections: { ...empty, alerts: undefined } }), /alerts is missing/],
    ["a bad record, named by collection and position", backup({ collections: { ...empty, notes: [{ ...sample("notes", "n1"), updatedAt: AT, title: 1 }] } }), /notes\[0\]: n1: title/],
    [
      "the same id twice",
      backup({ collections: { ...empty, accounts: [{ ...sample("accounts", "a1"), updatedAt: AT }, { ...sample("accounts", "a1"), updatedAt: AT }] } }),
      /id a1 appears twice/,
    ],
  ])("rejects %s", (_, data, message) => {
    const checked = checkExport(data);
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.error).toMatch(message);
  });

  it("reports only the first few problems, not thousands", () => {
    const bad = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}` }));
    const checked = checkExport(backup({ collections: { ...empty, notes: bad } }), 3);
    expect(!checked.ok && checked.error.split("; ")).toHaveLength(3);
  });
});
