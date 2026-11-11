import { runWithTools } from "modeldispatcher-browser-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RiskProfile } from "../api";
import { getProfile } from "../data/riskProfile";
import { deviceChat, rulesContext } from "./deviceChat";

vi.mock("modeldispatcher-browser-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("modeldispatcher-browser-agent")>()),
  runWithTools: vi.fn(),
}));
vi.mock("../data/riskProfile", () => ({ getProfile: vi.fn() }));

const profile: RiskProfile = {
  level: "moderate", saved: true, answers: {}, paper_mode: true, max_position_pct: 10, max_sector_pct: 30,
  min_safety_score: 55, max_volatility_pct: 35, max_drawdown_pct: 25, min_market_cap_m: 2000,
  allow_penny_stocks: false, cooling_off_hours: 24,
};

beforeEach(() => {
  vi.mocked(getProfile).mockResolvedValue(profile);
  vi.mocked(runWithTools).mockReset();
});

describe("rulesContext", () => {
  it("states the user's rules and the stock in view, as the server does", () => {
    const text = rulesContext(profile, "KO");

    expect(text).toContain("risk profile is 'moderate': max 10% in one stock, max 30% in one sector");
    expect(text).toContain("minimum market cap $2,000M, penny stocks not allowed");
    expect(text.endsWith(" The user is currently viewing KO.")).toBe(true);
  });
});

describe("deviceChat", () => {
  it("runs the chat in the browser with the device tools, the rules and the answer language", async () => {
    vi.mocked(runWithTools).mockResolvedValue({
      text: "KO is within your rules.", stopReason: "completed", toolsUsed: ["safety_check"],
      provider: "gemini", model: "gemini-2.5-flash", messages: [],
    });
    const config = { providers: [{ provider: "gemini" as const, model: "gemini-2.5-flash", apiKeys: ["k"] }], ollamaUrl: "" };

    const reply = await deviceChat(config, [{ role: "user", content: "Can I buy KO?" }], "KO", "he");

    const call = vi.mocked(runWithTools).mock.calls[0];
    if (!call) throw new Error("runWithTools was not called");
    const [usedConfig, messages, options] = call;
    expect(usedConfig).toBe(config);
    expect(messages).toEqual([{ role: "user", content: "Can I buy KO?" }]);
    expect(options.systemInstruction).toContain("Answer in Hebrew.");
    expect(options.systemInstruction).toContain("currently viewing KO");
    expect(options.tools).toHaveLength(21);
    expect(reply).toEqual({ content: "KO is within your rules.", model: "gemini/gemini-2.5-flash", toolsUsed: ["safety_check"] });
  });
});
