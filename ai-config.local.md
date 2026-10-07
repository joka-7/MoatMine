## Project: MoatMine

Investment app whose purpose is **risk-aware, safe investing**: users set their own risk rules and
the app checks every stock and the whole portfolio against them. Never describe returns as "safe" or
guaranteed in UI copy or prompts; it's risk control and information, not financial advice.

### Layout
- `backend/` — FastAPI on Render (`app/`), SQLAlchemy models, background worker (`app/worker.py`),
  MCP server at `/mcp`. Market data via `app/market/` (mock | finnhub, optional FMP).
- `web/` — Next.js 15 on Vercel. Same UI is static-exported (`npm run build:desktop`) for desktop.
- `desktop/` — Tauri v2 shell over `web/out`, calling the same Render API.
- `.ai/` — ogen-ai submodule (this config). Don't edit files under `.ai/` from this repo.

### Commands
- Backend tests: `cd backend && .venv/bin/python -m pytest -q` (must pass before every commit)
- Web: `cd web && npx tsc --noEmit && npm run build && npm run build:desktop`
- Seed demo data: `cd backend && python -m app.seed`
- Regenerate AI config after editing `ai-config.*`: `python .ai/bin/ai-sync`

### Domain terms
- **PAPI** = Profit, Amount, Period, Intent — a target per symbol or the whole portfolio.
- **MAMI** = MAx/MIn bounds for each PAPI dimension. Intent's bounds apply to risk (annualised volatility %).
- **Safety score / risk profile / safety check** — see `backend/app/safety/`.

### Conventions
- **Never add Claude attribution** to commits or PRs: no `Co-Authored-By: Claude`, no session/chat URL.
- AI calls go through **ModelDispatcher** (`model-dispatcher` on PyPI, `modeldispatcher-*` on npm,
  https://github.com/joka-7/ModelDispatcher). Don't add another LLM SDK or router.
- The mock market provider must keep every feature working with no API keys; anything shown from
  mock data must be labelled as sample data in the UI.
- Valuation, safety and crisis maths are pure functions with unit tests using hand-checkable numbers.
