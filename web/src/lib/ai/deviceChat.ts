import { runWithTools, type AgentConfig } from "modeldispatcher-browser-agent";
import type { ChatMsg, RiskProfile } from "../api";
import { getProfile } from "../data/riskProfile";
import { deviceTools } from "./deviceTools";

/** Same wording as the server's `SYSTEM_PROMPT` (backend/app/ai/dispatcher.py). */
const SYSTEM_PROMPT =
  "You are MoatMine's investment assistant. The app's purpose is safe, risk-aware investing. " +
  "Use the tools to look at the user's real portfolio, risk profile, safety scores, targets (PAPI: profit, " +
  "amount, period, intent with MAMI min/max bounds), watchlist, company data, earnings, analyst views, news, " +
  "crisis history and the valuation models before answering. Always surface downside risk. When discussing " +
  "value, show the spread between models and the assumptions behind them rather than one number. Be concise " +
  "and numeric. You provide information and analysis, not personalised financial advice; never claim " +
  "certainty about future prices and never call an investment safe. You cannot place trades.";

const ANSWER_IN: Record<"en" | "he", string> = {
  en: "",
  he: "\nAnswer in Hebrew. Keep ticker symbols, company names and numbers as they are.",
};

/** Bind the agent to the user's own risk rules, as the server's `agent_context` does. */
export function rulesContext(p: RiskProfile, symbol: string | undefined): string {
  const rules =
    `The user's risk profile is '${p.level}'${p.saved ? "" : " (default, not yet set by the user)"}: ` +
    `max ${p.max_position_pct}% in one stock, max ${p.max_sector_pct}% in one sector, ` +
    `minimum safety score ${p.min_safety_score}, max volatility ${p.max_volatility_pct}%/yr, ` +
    `portfolio loss limit ${p.max_drawdown_pct}%, minimum market cap $${p.min_market_cap_m.toLocaleString("en-US")}M, ` +
    `penny stocks ${p.allow_penny_stocks ? "allowed" : "not allowed"}. ` +
    "Run safety_check before discussing any buy. If something breaks these rules, say so plainly and " +
    "do not help work around them; the user can change the rules only in the Risk profile page. " +
    "Real-money and paper (practice) accounts are separate books: the portfolio tools default to real money; " +
    "pass mode='paper' only when the user asks about paper trading, and never add the two together.";
  return rules + (symbol ? ` The user is currently viewing ${symbol}.` : "");
}

export interface DeviceChatReply {
  readonly content: string;
  readonly model: string;
  readonly toolsUsed: readonly string[];
}

/**
 * One chat turn in local mode: the model is called from this browser with the user's own keys, and
 * its tools read the portfolio from this device. Nothing about the user's data passes through the
 * MoatMine server; market data is fetched from it by symbol only.
 *
 * @throws NoProviderConfiguredError when no AI provider is set up on this device.
 * @throws AllProvidersExhaustedError when every configured provider failed.
 */
export async function deviceChat(
  config: AgentConfig,
  messages: readonly ChatMsg[],
  symbol: string | undefined,
  language: "en" | "he",
): Promise<DeviceChatReply> {
  const userSaid = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const system = `${SYSTEM_PROMPT}${ANSWER_IN[language]}\n${rulesContext(await getProfile(true), symbol)}`;
  const out = await runWithTools(
    config,
    messages.map(({ role, content }) => ({ role, content })),
    { tools: deviceTools(userSaid), systemInstruction: system, maxTokens: 2048 },
  );
  return { content: out.text, model: `${out.provider}/${out.model}`, toolsUsed: out.toolsUsed };
}
