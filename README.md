# Folio

Investment tracker with one UI for **web (Vercel)** and **desktop (Tauri)**, backed by one **FastAPI service on Render**.

```
web/        Next.js 15 + TS — Vercel; same code static-exported for desktop
desktop/    Tauri v2 shell that loads web/out and calls the Render API
backend/    FastAPI + SQLAlchemy + Postgres — API, background worker, MCP server
render.yaml Render blueprint (API, worker, Postgres)
```

## Features

| Area | What you get |
|---|---|
| Accounts & portfolio | Accounts with cash, holdings, live P/L, weights, day change, allocation donut, value-over-time chart |
| Watchlist | Symbols with notes and price alerts (above / below) |
| Stock page | Candles or line chart, 1D–5Y ranges, SMA20/50 and volume overlays, zoom in/out/fit plus wheel and drag |
| Ratios | Valuation, profitability and health ratios from the provider; return, volatility, max drawdown, Sharpe, Sortino, RSI and SMA computed from candles, with a selectable lookback |
| News & my info | Provider news by date window; your own notes, thesis, news and links per stock |
| **PAPI / MAMI targets** | **P**rofit %, **A**mount (value), **P**eriod (days held), **I**ntent (category plus risk as annualised volatility %). Each has a target and **MA**x/**MI**n bounds. Scope is one symbol or the whole portfolio. Shown as live range bars. |
| Alerts | Worker evaluates targets and watch prices and writes de-duplicated alerts (bell menu) |
| AI agent | Tool-using chat (portfolio, quotes, ratios, news, targets, watchlist, notes) through a **model dispatcher** |
| Bring your own AI | Per-user API keys (Fernet-encrypted), or an **external agent** at any OpenAI-compatible endpoint |
| MCP | `/mcp/` exposes the same tools to Claude Desktop, Claude Code or any MCP client, using per-user revocable tokens |

### Model dispatcher (`backend/app/ai/dispatcher.py`)
- `auto`: short or simple questions go to `FAST_MODEL`; analysis questions go to `DEFAULT_MODEL`.
- Any LiteLLM model id can be picked explicitly (`anthropic/…`, `openai/…`, `gemini/…`).
- Key order for each provider: the user's own key first, then the server env key.
- If a model fails, the dispatcher walks `FALLBACK_MODELS`.
- `external` forwards the conversation to the user's own agent.

The agent has no tool that places trades.

## Run locally

```bash
# API
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env    # set FERNET_KEY (command is in the file); add an AI key to try the agent
python -m app.seed      # demo data for user "dev"
uvicorn app.main:app --reload
pytest                  # 15 tests

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
- `FERNET_KEY`
- Clerk JWKS URL and issuer
- AI keys (optional)
- `CORS_ORIGINS` = your Vercel URL plus `tauri://localhost,http://tauri.localhost`

**Vercel.** Import the repo with root directory `web`, and set `NEXT_PUBLIC_API_URL=https://<folio-api>.onrender.com`.

**Desktop.** Set `NEXT_PUBLIC_API_URL` before `npm run build` so the installer points at Render. Users can also change the URL in Settings. If your API isn't on `*.onrender.com`, add its domain to the CSP `connect-src` in `desktop/src-tauri/tauri.conf.json`.

## Before real users

- **Auth.** `AUTH_MODE=dev` trusts the bearer token as the user id, so use it only on your machine. For production:
  1. Set `AUTH_MODE=clerk` on Render.
  2. Add `@clerk/nextjs` to `web/`.
  3. Return Clerk's `getToken()` from `authToken()` in `web/src/lib/api.ts`.
- **Schema.** Tables are created with `create_all`. Add Alembic before changing the schema on a live database.
- **Market data licensing.** Finnhub's free plan is for personal use. Check the terms before showing its data to other users. `/stock/candle` may need a paid Finnhub plan; until then, charts fall back to sample data and say so.
- **Broker sync.** SnapTrade or Plaid Investments can fill the existing `accounts` and `holdings` tables. Today they are entered manually.
- **Chat.** Chat replies are not streamed yet (one response per turn).
