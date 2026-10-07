# Moatrics

*Know how safe your investments are.*

Risk-aware investing app: every stock gets a graded safety score, every buy is checked against the user's own risk rules, and the portfolio is stress-tested against past crises. One UI for **web (Vercel)** and **desktop (Tauri)**, backed by one **FastAPI service on Render**.

```
web/        Next.js 15 + TS — Vercel; same code static-exported for desktop
desktop/    Tauri v2 shell that loads web/out and calls the Render API
backend/    FastAPI + SQLAlchemy + Postgres — API, background worker, MCP server, safety engine (app/safety/)
.ai/        ogen-ai submodule: shared AI-assistant rules, skills, commands and role agents
render.yaml Render blueprint (API, worker, Postgres)
```

## Features

| Area | What you get |
|---|---|
| **Safety score** | 0–100 final score and A–F grades by area (financial health, quality & earnings, price risk, crisis resilience, size, valuation), red flags, a rule-based summary and an AI analyzer that explains the grades against the user's rules |
| **Risk profile** | 5-question questionnaire → conservative / moderate / balanced / growth, with editable rules: max position %, max sector %, minimum safety score, max volatility, portfolio loss limit, minimum company size, penny stocks, cooling-off hours, paper mode |
| **Safety check & buy plans** | Every buy is checked against the rules: pass, warn (needs a written reason + cooling-off wait) or block. The reason is saved to the stock's journal. Paper accounts enforce blocks; real accounts warn |
| **Portfolio risk** | Volatility, beta, 1-month value-at-risk, worst fall, concentration, sectors vs limit, correlation heatmap, rule breaches (also raised as alerts by the worker) |
| **Stress tests** | Today's holdings replayed through the dot-com crash, 2008, 2011, Q4 2018, COVID and 2022, plus 10/20/35% market falls, against the user's loss limit |
| Accounts & portfolio | Accounts with cash, holdings, live P/L, weights, day change, allocation donut, value-over-time chart |
| Watchlist | Symbols with notes and price alerts (above / below) |
| Stock page | Candles or line chart, 1D–5Y ranges, SMA20/50 and volume overlays, zoom in/out/fit plus wheel and drag |
| Ratios | Valuation, profitability and health ratios from the provider; return, volatility, max drawdown, Sharpe, Sortino, RSI and SMA computed from candles, with a selectable lookback |
| Company info | Description, sector, industry, employees, CEO, IPO, website, market cap |
| Earnings & dividends | EPS actual vs estimate with surprise %, dividend history chart, stock splits |
| Analysts | Recommendation trend (strong buy … strong sell) and consensus price target vs current price |
| **Value estimator** | Eight fair-value models side by side: 2-stage DCF, Graham number, Graham formula, Peter Lynch, dividend discount, earnings power value, P/E multiple and EV/EBITDA multiple. Summary shows the median fair value, low–high range, a margin-of-safety "buy below" price and a verdict. Every assumption is editable (discount rate, growth, terminal growth, years, MOS, bond yield, fair multiples). |
| Valuation indicators | PEG, earnings yield, FCF yield, P/FCF, P/B, dividend yield, payout ratio, EV/EBITDA, net debt/EBITDA |
| Bad times | How the stock did in the dot-com crash, 2008, 2011, Q4 2018, COVID and 2022 vs SPY (or any benchmark): fall, time to recover, downside capture, and its own worst drawdowns |
| Quality scores | Piotroski F-score with all 9 checks, and Altman Z-score with its zone |
| News | Per-stock news by date window, an AI digest with sentiment (fast model, cached 1h), and a dashboard feed across holdings and watchlist |
| My info | Your own notes, thesis, news and links per stock |
| **PAPI / MAMI targets** | **P**rofit %, **A**mount (value), **P**eriod (days held), **I**ntent (category plus risk as annualised volatility %). Each has a target and **MA**x/**MI**n bounds. Scope is one symbol or the whole portfolio. Shown as live range bars. |
| Alerts | Worker evaluates targets and watch prices and writes de-duplicated alerts (bell menu) |
| AI agent | Tool-using chat through **[ModelDispatcher](https://github.com/joka-7/ModelDispatcher)**, bound to the user's risk profile. Tools: portfolio, risk profile, safety score, safety check, portfolio risk, stress test, quotes, ratios, company, earnings, analysts, dividends, valuation, bad times, news feed, targets, watchlist, notes |
| AI settings | ModelDispatcher's shared `<ModelPicker>`: providers in fallback order, a model each, pooled keys (encrypted server-side), a favorite free AI app (`<AskExternallyButton>` / `<PasteExternalReply>` in chat), plus an **external agent** at any OpenAI-compatible base URL |
| MCP | `/mcp/` exposes the same tools to Claude Desktop, Claude Code or any MCP client, using per-user revocable tokens |

### AI via ModelDispatcher (`backend/app/ai/dispatcher.py`)

All AI calls (chat, news digest, safety analyzer) go through `model-dispatcher` (PyPI) and the web
uses `modeldispatcher-react-ui` / `modeldispatcher-browser-agent` (npm), both 0.6.7.

- Per request the backend builds a provider registry from the user's AI settings plus any vendor the
  server has a key for (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`).
- `auto`: ModelDispatcher triages the question and routes cheapest-capable first, falling back across
  vendors and across a user's pooled keys. A vendor id pins that vendor; `external` uses the user's agent.
- The user's own key always wins over the server key for the same vendor.
- Per-user quotas (`AI_REQUESTS_PER_MIN`, `AI_TOKENS_PER_MIN`, `AI_TOKENS_PER_DAY`); when the shared
  key runs out the API returns ModelDispatcher's handoff and the chat links to AI settings.

The agent has no tool that places trades.

## Clone

```bash
git clone --recurse-submodules <repo-url>   # .ai is the ogen-ai submodule
python .ai/bin/ai-sync                      # only after editing ai-config.toml / ai-config.local.md
```

## Run locally

```bash
# API
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env    # set FERNET_KEY (command is in the file); add an AI key to try the agent
python -m app.seed      # demo data for user "dev"
uvicorn app.main:app --reload
pytest                  # 62 tests

# Web
cd web
cp .env.example .env.local
npm install && npm run dev        # http://localhost:3000

# Desktop (needs Rust + Tauri system deps: https://tauri.app/start/prerequisites/)
cd desktop
npm install
npm run dev     # opens a native window on top of the Next dev server
npm run build   # static-exports web/ and bundles installers (.msi/.dmg/.deb/.AppImage)
```

The app runs with **no API keys**: `MARKET_PROVIDER=mock` serves deterministic sample prices, and the UI labels them as sample data.

## Deploy

**Render.** New → Blueprint → this repo. Then fill in the prompted secrets:
- `FINNHUB_API_KEY`
- `FMP_API_KEY` (optional: company descriptions, financial statements for Piotroski/Altman, price targets, dividends)
- `FERNET_KEY`
- Clerk JWKS URL and issuer
- AI keys (optional)
- `CORS_ORIGINS` = your Vercel URL plus `tauri://localhost,http://tauri.localhost`

**Vercel.** Import the repo with root directory `web`, and set `NEXT_PUBLIC_API_URL=https://<moatrics-api>.onrender.com`.

**Desktop.** Set `NEXT_PUBLIC_API_URL` before `npm run build` so the installer points at Render. Users can also change the URL in Settings. If your API isn't on `*.onrender.com`, add its domain to the CSP `connect-src` in `desktop/src-tauri/tauri.conf.json`.

## Before real users

- **Auth.** `AUTH_MODE=dev` trusts the bearer token as the user id, so use it only on your machine. For production:
  1. Set `AUTH_MODE=clerk` on Render.
  2. Add `@clerk/nextjs` to `web/`.
  3. Return Clerk's `getToken()` from `authToken()` in `web/src/lib/api.ts`.
- **Schema.** Tables are created with `create_all`. Add Alembic before changing the schema on a live database.
- **Data coverage.** Free Finnhub gives quotes, news, ratios, earnings, recommendations and splits. Company descriptions, statements (Piotroski, Altman), price targets and dividend history need `FMP_API_KEY` or a paid Finnhub plan; without them those sections say so instead of breaking. The FMP mapping follows FMP's documented `/stable` fields but hasn't been run against a live key yet.
- **Market data licensing.** Finnhub's free plan is for personal use. Check the terms before showing its data to other users. `/stock/candle` may need a paid Finnhub plan; until then, charts fall back to sample data and say so.
- **Broker sync.** SnapTrade or Plaid Investments can fill the existing `accounts` and `holdings` tables. Today they are entered manually.
- **Chat.** Chat replies are not streamed yet (one response per turn).
