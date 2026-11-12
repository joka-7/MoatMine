import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore, MemoryBackend } from "../store";
import { agentConfigOf, loadDeviceAiSettings, saveDeviceAiSettings } from "./aiSettings";

let store = new LocalStore(new MemoryBackend());
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
});

describe("agentConfigOf", () => {
  it("keeps well-formed providers and drops the rest, since a backup is untrusted", () => {
    expect(
      agentConfigOf({
        providers: [
          { provider: "gemini", model: "gemini-2.5-flash", apiKeys: ["k1"] },
          { provider: "made-up", model: "m", apiKeys: [] },
          { provider: "openai", model: 3, apiKeys: [] },
          { provider: "groq", model: "llama", apiKeys: [1] },
          "junk",
        ],
        ollamaUrl: 5,
      }),
    ).toEqual({ providers: [{ provider: "gemini", model: "gemini-2.5-flash", apiKeys: ["k1"] }], ollamaUrl: "" });
  });
});

describe("loadDeviceAiSettings", () => {
  it("returns nothing configured on a fresh device", async () => {
    expect(await loadDeviceAiSettings()).toEqual({ config: { providers: [], ollamaUrl: "" }, favorite: null });
  });
});

describe("saveDeviceAiSettings", () => {
  it("keeps the settings on the device for the next load", async () => {
    const settings = {
      config: { providers: [{ provider: "anthropic" as const, model: "claude-haiku-4-5", apiKeys: ["sk-ant"] }], ollamaUrl: "" },
      favorite: "claude" as const,
    };

    await saveDeviceAiSettings(settings);

    expect(await loadDeviceAiSettings()).toEqual(settings);
  });
});
