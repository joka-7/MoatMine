import type { Tool, ToolSpec } from "modeldispatcher-browser-agent";
import { api } from "../api";
import type { BookMode } from "../calc/types";
import { addNote, listNotes } from "../data/notes";
import { getPortfolio, LOCAL_BOOK } from "../data/portfolio";
import { portfolioRiskReport, stressReport } from "../data/risk";
import { getProfile } from "../data/riskProfile";
import { checkOnDevice } from "../data/safetyCheck";
import { evaluateTargets } from "../data/targets";
import { addWatch, listWatch } from "../data/watchlist";

/**
 * The AI chat's tools for local mode: the same names, descriptions and arguments as the server's
 * (`backend/app/ai/tools.py`), but the user's own data is read from this device. Market data is
 * fetched from the API by symbol only. The paper book still lives on the server, so its tools ask
 * the server, as the paper pages do.
 */

type Args = Readonly<Record<string, unknown>>;

const symbolParam = (description = "Ticker symbol, e.g. AAPL") => ({
  type: "object",
  properties: { symbol: { type: "string", description } },
  required: ["symbol"],
});
const MODE_PROP = {
  mode: {
    type: "string",
    enum: ["real", "paper"],
    description: "Which book: 'real' money (default) or 'paper' practice accounts. They are never mixed.",
  },
};
const modeParam = () => ({ type: "object", properties: { ...MODE_PROP } });
const noParams = () => ({ type: "object", properties: {} });

const symbolOf = (args: Args): string => String(args["symbol"] ?? "").trim().toUpperCase();
const modeOf = (args: Args): BookMode => (args["mode"] === "paper" ? "paper" : "real");
const stock = (args: Args, path: string) => `/stocks/${encodeURIComponent(symbolOf(args))}/${path}`;

/**
 * Whether the user's own message names this ticker as a whole word (same rule as the server's
 * `user_named`). Tickers of up to three letters are often ordinary words ("it", "on", "all"), so for
 * them only a capitalised or $-prefixed mention counts; longer ones match in any case.
 */
export function userNamed(symbol: string, userSaid: string): boolean {
  if (!symbol) return false;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = `(?<![A-Za-z0-9.])${escaped}(?![A-Za-z0-9])`;
  if (symbol.length > 3) return new RegExp(word, "i").test(userSaid);
  return new RegExp(word).test(userSaid) || new RegExp(`\\$${escaped}(?![A-Za-z0-9])`, "i").test(userSaid);
}

interface ToolDef {
  readonly spec: ToolSpec;
  /** Changes the user's data: only for a symbol the user named in their own message. */
  readonly writes?: boolean;
  readonly run: (args: Args) => Promise<unknown>;
}

async function newsFeed(): Promise<unknown> {
  const [portfolio, watch] = await Promise.all([getPortfolio(LOCAL_BOOK, true), listWatch(true)]);
  const symbols = [...new Set([...portfolio.holdings.map((h) => h.symbol), ...watch.map((w) => w.symbol)])];
  const perSymbol = await Promise.all(
    symbols.map(async (symbol) => {
      const items = await api<{ headline: string; source: string; datetime: number }[]>(`/stocks/${encodeURIComponent(symbol)}/news`);
      return items.map((n) => ({ symbol, headline: n.headline, source: n.source, datetime: n.datetime }));
    }),
  );
  return perSymbol.flat().sort((a, b) => b.datetime - a.datetime).slice(0, 25);
}

const TOOLS: readonly ToolDef[] = [
  {
    spec: { name: "get_portfolio", description: "User's accounts, holdings with P/L and weights, and totals for the real-money or the paper book.", parameters: modeParam() },
    run: (a) => getPortfolio(modeOf(a), modeOf(a) === LOCAL_BOOK),
  },
  { spec: { name: "get_quote", description: "Latest quote for a symbol.", parameters: symbolParam() }, run: (a) => api(stock(a, "quote")) },
  {
    spec: { name: "get_ratios", description: "Fundamental ratios (P/E, ROE, margins…) and 1-year price/risk stats (volatility, drawdown, Sharpe, RSI).", parameters: symbolParam() },
    run: (a) => api(stock(a, "ratios")),
  },
  {
    spec: { name: "get_news", description: "Recent company news headlines for a symbol.", parameters: symbolParam() },
    run: async (a) =>
      (await api<{ headline: string; source: string; datetime: number; url: string }[]>(stock(a, "news")))
        .slice(0, 10)
        .map(({ headline, source, datetime, url }) => ({ headline, source, datetime, url })),
  },
  {
    spec: { name: "get_company", description: "Company profile: description, sector, industry, employees, website, IPO date, market cap.", parameters: symbolParam() },
    run: async (a) => ({ ...(await api<object>(stock(a, "profile"))), ...(await api<object>(stock(a, "company"))) }),
  },
  { spec: { name: "get_earnings", description: "Recent quarterly EPS: actual vs estimate and surprise %.", parameters: symbolParam() }, run: (a) => api(stock(a, "earnings")) },
  {
    spec: { name: "get_analysts", description: "Analyst recommendation trend (strong buy … strong sell) and consensus price target.", parameters: symbolParam() },
    run: (a) => api(stock(a, "analysts")),
  },
  { spec: { name: "get_dividends", description: "Dividend history and stock splits.", parameters: symbolParam() }, run: (a) => api(stock(a, "dividends")) },
  {
    spec: {
      name: "get_valuation",
      description:
        "Fair-value estimate from several models (DCF, Graham, Lynch, DDM, EPV, P/E and EV/EBITDA multiples), valuation indicators " +
        "(PEG, FCF yield, payout…) and quality scores (Piotroski F, Altman Z). Optional assumption overrides in percent.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          discount_rate: { type: "number" },
          growth_rate: { type: "number" },
          terminal_growth: { type: "number" },
          margin_of_safety: { type: "number" },
        },
        required: ["symbol"],
      },
    },
    run: (a) => {
      // The API holds overrides to its own bounds (422 otherwise), which the model reads as an error.
      const query = new URLSearchParams(
        ["discount_rate", "growth_rate", "terminal_growth", "margin_of_safety"].flatMap((k) =>
          typeof a[k] === "number" ? [[k, String(a[k])]] : [],
        ),
      ).toString();
      return api(stock(a, `valuation${query ? `?${query}` : ""}`));
    },
  },
  {
    spec: {
      name: "get_bad_times",
      description:
        "How the stock behaved in past market crises (dot-com, 2008, 2011, Q4 2018, COVID, 2022) vs SPY: drawdown, recovery time, " +
        "downside capture, plus its own worst drawdowns. Use for any safety/risk question.",
      parameters: symbolParam(),
    },
    run: (a) => api(stock(a, "crises")),
  },
  {
    spec: {
      name: "get_risk_profile",
      description:
        "The user's own risk rules: level, max position/sector %, minimum safety score, volatility and loss limits, cooling-off. Every recommendation must respect these.",
      parameters: noParams(),
    },
    run: () => getProfile(true),
  },
  {
    spec: {
      name: "get_safety_score",
      description:
        "0–100 safety score for a stock with its components (Altman Z, Piotroski, debt, volatility, worst fall, crisis resilience, size, earnings, " +
        "valuation, moat: return on capital, margin stability, steady growth) with A–F grades by area and red flags.",
      parameters: symbolParam(),
    },
    run: (a) => api(stock(a, "safety")),
  },
  {
    spec: {
      name: "safety_check",
      description: "Check a proposed buy against the user's risk rules: pass / warn / block with each rule's result. Run this before discussing any buy.",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string" }, amount: { type: "number", description: "money to invest" }, ...MODE_PROP },
        required: ["symbol", "amount"],
      },
    },
    run: async (a) => {
      const amount = Number(a["amount"]);
      if (!(amount > 0)) throw new Error("amount must be a positive number");
      if (modeOf(a) === "paper") return api("/safety/check", { method: "POST", json: { symbol: symbolOf(a), amount, mode: "paper" } });
      return checkOnDevice(symbolOf(a), amount, await getPortfolio(LOCAL_BOOK, true));
    },
  },
  {
    spec: {
      name: "get_portfolio_risk",
      description: "Portfolio volatility, beta, value-at-risk, max drawdown, concentration, sectors, correlation and rule breaches, for the real-money or the paper book.",
      parameters: modeParam(),
    },
    run: (a) => (modeOf(a) === "paper" ? api("/safety/portfolio?mode=paper") : portfolioRiskReport()),
  },
  {
    spec: {
      name: "get_stress_test",
      description: "Today's portfolio (real-money or paper book) replayed through past crises and market falls of 10/20/35%, vs the user's loss limit.",
      parameters: modeParam(),
    },
    run: (a) => (modeOf(a) === "paper" ? api("/safety/stress?mode=paper") : stressReport()),
  },
  { spec: { name: "get_news_feed", description: "Recent news across all holdings and watchlist symbols.", parameters: noParams() }, run: newsFeed },
  {
    spec: { name: "get_targets_status", description: "User's PAPI targets (profit, amount, period, intent) evaluated against their min/max bounds.", parameters: noParams() },
    run: () => evaluateTargets(true),
  },
  { spec: { name: "get_watchlist", description: "User's watchlist with live quotes.", parameters: noParams() }, run: () => listWatch(true) },
  {
    spec: { name: "get_notes", description: "User's own saved notes/thesis for a symbol.", parameters: symbolParam() },
    run: async (a) => (await listNotes(symbolOf(a), true)).map((n) => ({ kind: n.kind, title: n.title, body: n.body.slice(0, 2000) })),
  },
  {
    spec: {
      name: "add_to_watchlist",
      description: "Add a symbol to the user's watchlist. Only when the user asks.",
      parameters: { type: "object", properties: { symbol: { type: "string" }, note: { type: "string" } }, required: ["symbol"] },
    },
    writes: true,
    run: async (a) => {
      await addWatch({ symbol: symbolOf(a), note: String(a["note"] ?? ""), alert_above: null, alert_below: null });
      return { ok: true, symbol: symbolOf(a) };
    },
  },
  {
    spec: {
      name: "save_note",
      description: "Save a note about a symbol to the user's stock page. Only when the user asks.",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string" }, title: { type: "string" }, body: { type: "string" } },
        required: ["symbol", "title", "body"],
      },
    },
    writes: true,
    run: async (a) => {
      await addNote(symbolOf(a), { kind: "note", title: String(a["title"] ?? "").slice(0, 200), body: String(a["body"] ?? ""), url: "" });
      return { ok: true };
    },
  },
];

/**
 * The tools for one chat turn. `userSaid` is the user's latest message: write tools only act on a
 * symbol it names, so text the model read elsewhere (a headline) can't change the user's data.
 */
export function deviceTools(userSaid: string): Tool[] {
  return TOOLS.map((def) => ({
    spec: def.spec,
    run: async (args: Args) => {
      if (def.writes && !userNamed(symbolOf(args), userSaid)) {
        return JSON.stringify({ error: "write tools only act on a symbol the user named in their own message; ask them first" });
      }
      return JSON.stringify(await def.run(args));
    },
  }));
}
