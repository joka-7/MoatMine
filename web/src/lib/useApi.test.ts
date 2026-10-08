import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { useApi } from "./useApi";

vi.mock("./api", () => ({ api: vi.fn() }));
const mockedApi = vi.mocked(api);

function deferred<T>() {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  mockedApi.mockReset();
});

describe("useApi", () => {
  it("ignores a slower response for a path it has moved away from", async () => {
    const real = deferred<string>();
    const paper = deferred<string>();
    mockedApi.mockImplementation((path: string) => (path.includes("paper") ? paper.promise : real.promise));

    const { result, rerender } = renderHook(({ path }) => useApi<string>(path), { initialProps: { path: "/portfolio?mode=real" } });
    rerender({ path: "/portfolio?mode=paper" });
    await act(async () => paper.resolve("paper book"));
    await act(async () => real.resolve("real book")); // arrives last, but was superseded

    expect(result.current.data).toBe("paper book");
  });

  it("clears the old data when the path changes, rather than showing it under the new label", async () => {
    mockedApi.mockResolvedValueOnce("real book");
    const next = deferred<string>();
    mockedApi.mockReturnValueOnce(next.promise);

    const { result, rerender } = renderHook(({ path }) => useApi<string>(path), { initialProps: { path: "/a" } });
    await waitFor(() => expect(result.current.data).toBe("real book"));
    rerender({ path: "/b" });

    await waitFor(() => expect(result.current.data).toBeNull());
    await act(async () => next.resolve("paper book"));
    expect(result.current.data).toBe("paper book");
  });

  it("reports the error message when the request fails", async () => {
    mockedApi.mockRejectedValueOnce(new Error("API down"));
    const { result } = renderHook(() => useApi<string>("/x"));
    await waitFor(() => expect(result.current.error).toBe("API down"));
    expect(result.current.data).toBeNull();
  });
});
