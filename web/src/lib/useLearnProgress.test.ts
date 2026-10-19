import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLearnProgress } from "./useLearnProgress";

beforeEach(() => window.localStorage.clear());

describe("useLearnProgress", () => {
  it.each([
    ["nothing saved", null, {}],
    ["corrupt data", "{oops", {}],
    ["saved scores", '{"risk":3}', { risk: 3 }],
  ])("starts from %s", (_, saved, expected) => {
    if (saved !== null) window.localStorage.setItem("moatmine.learn", saved);
    expect(renderHook(() => useLearnProgress()).result.current[0]).toEqual(expected);
  });

  it("records the best score and saves it for the next visit", () => {
    const { result } = renderHook(() => useLearnProgress());
    act(() => result.current[1]("risk", 2));
    act(() => result.current[1]("risk", 1));
    expect(result.current[0]).toEqual({ risk: 2 });
    expect(JSON.parse(window.localStorage.getItem("moatmine.learn") ?? "null")).toEqual({ risk: 2 });
    expect(renderHook(() => useLearnProgress()).result.current[0]).toEqual({ risk: 2 });
  });
});
