import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIntroSeen } from "./useIntroSeen";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("useIntroSeen", () => {
  it("reports not seen for a new browser, then seen once marked, and remembers it", () => {
    const first = renderHook(() => useIntroSeen());
    expect(first.result.current.seen).toBe(false);

    act(() => first.result.current.markSeen());
    expect(first.result.current.seen).toBe(true);

    expect(renderHook(() => useIntroSeen()).result.current.seen).toBe(true);
  });

  it("treats the intro as seen when storage is blocked, so it can't redirect on every visit", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(renderHook(() => useIntroSeen()).result.current.seen).toBe(true);
  });
});
