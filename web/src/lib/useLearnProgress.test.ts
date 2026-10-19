import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLearnProgress } from "./useLearnProgress";

beforeEach(() => window.localStorage.clear());

describe("useLearnProgress", () => {
  it.each([
    ["nothing saved", null, []],
    ["corrupt data", "{oops", []],
    ["scores from the earlier quiz version", '{"risk":3}', []],
    ["saved modules", '["risk","company"]', ["risk", "company"]],
  ])("starts from %s", (_, saved, expected) => {
    if (saved !== null) window.localStorage.setItem("moatmine.learn", saved);
    expect(renderHook(() => useLearnProgress()).result.current[0]).toEqual(expected);
  });

  it("marks a module complete, saves it for the next visit, and can undo it", () => {
    const { result } = renderHook(() => useLearnProgress());
    act(() => result.current[1]("risk", true));
    expect(result.current[0]).toEqual(["risk"]);
    expect(JSON.parse(window.localStorage.getItem("moatmine.learn") ?? "null")).toEqual(["risk"]);
    expect(renderHook(() => useLearnProgress()).result.current[0]).toEqual(["risk"]);

    act(() => result.current[1]("risk", false));
    expect(result.current[0]).toEqual([]);
  });
});
