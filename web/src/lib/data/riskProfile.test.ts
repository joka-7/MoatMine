import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { DEFAULT_RULES } from "../calc/profile";
import { setLocalMode } from "../localMode";
import { LocalStore, MemoryBackend } from "../store";
import { AUTO_TARGET, getProfile, localRules, saveProfile } from "./riskProfile";

let store = new LocalStore(new MemoryBackend());
vi.mock("../api", () => ({ api: vi.fn() }));
vi.mock("../store/shared", () => ({ portfolioStore: () => Promise.resolve(store) }));
const mockedApi = vi.mocked(api);

const middling = { horizon: 2, drop: 2, goal: 2, experience: 2, income: 2 }; // balanced

beforeEach(() => {
  store = new LocalStore(new MemoryBackend());
  mockedApi.mockReset();
  window.localStorage.clear();
  setLocalMode(true);
});

describe("getProfile", () => {
  it("reads from the server when not local", async () => {
    setLocalMode(false);
    mockedApi.mockResolvedValueOnce({ saved: true });
    expect(await getProfile(false)).toEqual({ saved: true });
    expect(mockedApi).toHaveBeenCalledWith("/safety/profile");
  });

  it("is the unsaved moderate profile before anything is saved", async () => {
    expect(await getProfile(true)).toMatchObject({ saved: false, level: "moderate", paper_mode: true, ...DEFAULT_RULES.moderate });
  });
});

describe("saveProfile", () => {
  it("puts the profile to the server when local mode is off", async () => {
    setLocalMode(false);
    await saveProfile({ level: "growth", paper_mode: true });
    expect(mockedApi).toHaveBeenCalledWith("/safety/profile", { method: "PUT", json: { level: "growth", paper_mode: true } });
  });

  it("sets the level from the questionnaire and uses that level's default rules", async () => {
    const saved = await saveProfile({ answers: middling, paper_mode: false });
    expect(saved).toMatchObject({ saved: true, level: "balanced", paper_mode: false, answers: middling, ...DEFAULT_RULES.balanced });
    expect(mockedApi).not.toHaveBeenCalled();
    expect(await getProfile(true)).toEqual(saved);
  });

  it("applies the user's own rule values over the level's defaults", async () => {
    const saved = await saveProfile({ level: "conservative", paper_mode: true, max_position_pct: 3, allow_penny_stocks: true });
    expect(saved).toMatchObject({ level: "conservative", max_position_pct: 3, allow_penny_stocks: true, max_sector_pct: 20 });
    expect((await localRules()).max_position_pct).toBe(3);
  });

  it("mirrors the volatility limit into one portfolio target, updated rather than duplicated on a second save", async () => {
    await saveProfile({ level: "conservative", paper_mode: true });
    await saveProfile({ level: "growth", paper_mode: true });
    const targets = await store.list("targets");
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ name: AUTO_TARGET, symbol: null, riskMax: 60, intent: "growth" });
  });

  it("uses the retirement intent for a conservative profile", async () => {
    await saveProfile({ level: "conservative", paper_mode: true });
    expect((await store.list("targets"))[0]).toMatchObject({ riskMax: 25, intent: "retirement" });
  });

  it.each([
    ["neither answers nor level", { paper_mode: true }, "send questionnaire answers or a level"],
    ["an unknown level", { level: "reckless", paper_mode: true }, "level must be one of"],
    ["an incomplete questionnaire", { answers: { horizon: 1 }, paper_mode: true }, "missing answers"],
    ["a position limit of zero", { level: "growth", paper_mode: true, max_position_pct: 0 }, "max_position_pct is out of range"],
    ["a loss limit that is not negative", { level: "growth", paper_mode: true, max_drawdown_pct: 5 }, "max_drawdown_pct is out of range"],
    ["a sector limit above 100", { level: "growth", paper_mode: true, max_sector_pct: 101 }, "max_sector_pct is out of range"],
  ])("rejects %s and saves nothing", async (_name, input, message) => {
    await expect(saveProfile(input)).rejects.toThrow(message);
    expect(await store.list("riskProfile")).toEqual([]);
  });
});
