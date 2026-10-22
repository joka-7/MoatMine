# Repository structure

Every file in this repo and what is inside it. The tree below is **generated** —
run `python .ai/skills/repo_tree/gen_tree.py --project . --output docs/STRUCTURE.md`
to refresh it, and never edit between the markers by hand.

<!-- BEGIN GENERATED TREE (depth=all entries=all) -->
```text
MoatMine/
├── .claude/                                      # Claude Code agents, commands and skills synced from .ai (ai-sync)
│   ├── agents/
│   │   ├── .ai-managed                           # Marker: directory is written by ai-sync
│   │   ├── architect.md                          # Reviews a target repo's structure and reports coupling, module boundaries,…
│   │   ├── ciso.md                               # Reviews a target repo for security exposure and reports hardcoded secrets,…
│   │   ├── developer.md                          # Implements specific, already-approved backlog items in a target repo — the…
│   │   ├── docs-sync.md                          # Keeps a target repo's documentation — in-code docs (README, docs/*.md,…
│   │   ├── engineering-manager.md                # Reviews a target repo's delivery health and reports CI gates, commit and PR…
│   │   ├── planner.md                            # Aggregates the completed role reports in .ai-reviews/ into one prioritized…
│   │   ├── product.md                            # Reviews a target repo from the user's side and reports docs-vs-behavior…
│   │   ├── qa.md                                 # Reviews a target repo's test suite and reports test coverage, isolation, mock…
│   │   ├── senior-dev.md                         # Reviews a target repo's line-level code quality and reports correctness…
│   │   ├── sre.md                                # Reviews a target repo's operability and reports healthchecks, graceful…
│   │   └── tracker.md                            # Keeps a target repo's Jira project in sync with its review backlog and…
│   ├── commands/
│   │   ├── .ai-managed                           # Marker: directory is written by ai-sync
│   │   ├── docs-bootstrap.md                     # Create a target repo's standard doc set from scratch
│   │   ├── review.md                             # Review the current diff against this repo's coding rules
│   │   ├── role-backlog.md                       # Re-aggregate the role reports already on disk into a fresh prioritized…
│   │   ├── role-implement.md                     # Implement specific, already-approved items from .ai-reviews/BACKLOG.md by…
│   │   ├── role-review.md                        # Run a full multi-role review over a target repo (local path or git URL) and…
│   │   ├── role.md                               # Run a single role agent (qa, architect, product, engineering-manager, sre,…
│   │   ├── sync-docs.md                          # Sync a target repo's in-code documentation and Confluence space with the…
│   │   ├── sync-tracker.md                       # Sync a target repo's review backlog and implementation status to Jira via the…
│   │   └── test.md                               # Write or extend tests for the code in $ARGUMENTS following the testing rules
│   └── skills/
│       ├── add-logging/
│       │   └── SKILL.md                          # Add or fix logging in code using the project's language-idiomatic structured…
│       ├── audit_repo/
│       │   ├── SKILL.md                          # Scan a target project and produce a scored (0-100) health report,…
│       │   └── run_audit.py                      # Collect objective repository-health signals for the audit_repo skill.
│       ├── conventional-commit/
│       │   └── SKILL.md                          # Write a Conventional Commits-formatted git commit message from staged changes
│       ├── customize_config/
│       │   ├── SKILL.md                          # Scaffold and apply ai-project-config.toml — a project-local override file for…
│       │   └── init_config.py                    # Scaffold `ai-project-config.toml` for the customize_config skill.
│       ├── lesson-capture/
│       │   └── SKILL.md                          # Turn a correction into a written rule instead of just a memory for this…
│       ├── port-module-to-ts/
│       │   └── SKILL.md                          # Port a JavaScript or Python module to TypeScript — translate its public API,…
│       ├── release-checklist/
│       │   └── SKILL.md                          # Walk through cutting a release — determine the version bump from commits…
│       ├── repo_tree/
│       │   ├── SKILL.md                          # Generate or refresh a repository's annotated file tree — the map of which…
│       │   └── gen_tree.py                       # Render an annotated file tree of a repository into a docs file.
│       ├── role_review/
│       │   ├── SKILL.md                          # The shared output contract for the role agents (qa, architect, product,…
│       │   └── run_manifest.py                   # Track role-review runs in a target repo's .ai-reviews/ directory.
│       ├── scaffold-python-service/
│       │   ├── template/                         # Scaffold template
│       │   │   ├── src/
│       │   │   │   └── example_service/
│       │   │   │       ├── __init__.py           # TODO: one-line package summary.
│       │   │   │       ├── errors.py             # Custom exception hierarchy, rooted at one base class per the Python rules.
│       │   │   │       ├── logging_config.py     # Called once, from the application entry point only.
│       │   │   │       └── main.py               # Typed FastAPI entrypoint.
│       │   │   ├── tests/
│       │   │   │   └── test_smoke.py             # One real smoke test exercising the entrypoint end to end, per the skill's…
│       │   │   ├── README.md                     # Scaffold template
│       │   │   └── pyproject.toml
│       │   └── SKILL.md                          # Scaffold a new Python backend service or package with the standard project…
│       ├── write-design-doc/
│       │   └── SKILL.md                          # Produce an HLD/LLD design document — either documenting an existing repo's…
│       └── .ai-managed                           # Marker: directory is written by ai-sync
├── .github/                                      # CI, Pages deploy and release workflows, and the pull request template
│   ├── workflows/
│   │   ├── alerts.yml                            # Each trading day after the US open: calls POST /internal/alerts/run,…
│   │   ├── android.yml                           # Builds and signs the Android APK with Tauri; attaches it to the release
│   │   ├── ci.yml                                # CI: backend ruff/mypy/pytest + OpenAPI drift, web tsc/lint/vitest/type drift…
│   │   ├── pages.yml                             # Publishes the static web export to GitHub Pages on pushes to main that touch…
│   │   └── release.yml                           # Tags and publishes v<version> with desktop installers on main when the…
│   └── pull_request_template.md                  # Why / what / how verified, plus the regenerate-and-document checklist
├── backend/                                      # FastAPI API, background worker, MCP server, safety/valuation maths, Alembic…
│   ├── app/                                      # The FastAPI application package
│   │   ├── ai/                                   # Agent tools, ModelDispatcher wiring and per-user AI settings
│   │   │   ├── __init__.py                       # Package marker
│   │   │   ├── dispatcher.py                     # AI calls through ModelDispatcher (https://github.com/joka-7/ModelDispatcher).
│   │   │   ├── llm_json.py                       # Pull the JSON object out of a model reply that was asked to answer in JSON.
│   │   │   ├── settings_store.py                 # Per-user AI settings in ModelDispatcher's AgentConfig shape, Fernet-encrypted…
│   │   │   └── tools.py                          # Tools the in-app agent can call
│   │   ├── market/                               # Market-data providers (mock, Finnhub, FMP) behind one protocol
│   │   │   ├── __init__.py                       # RoutedProvider (primary provider + optional FMP fallback) and the…
│   │   │   ├── base.py                           # MarketProvider protocol and the Quote/Candle/NewsItem shapes every provider…
│   │   │   ├── finnhub.py                        # Finnhub provider. Free tier covers quote, news, metrics, profile, search.
│   │   │   ├── fmp.py                            # Optional source for company descriptions, financial statements,
│   │   │   ├── mock.py                           # Deterministic fake market data so the app runs end-to-end without any API key.
│   │   │   ├── retry.py                          # Retrying GETs for the upstream market-data APIs.
│   │   │   └── sources.py                        # Which data actually fed a computation, tracked per task rather than on the…
│   │   ├── routers/                              # HTTP routes, one module per area
│   │   │   ├── __init__.py                       # Package marker
│   │   │   ├── ai.py                             # /ai: chat with tools, model picker, encrypted AI settings, MCP tokens;…
│   │   │   ├── internal.py                       # Routes for schedulers, not users: start an alert pass (the worker's job) from…
│   │   │   ├── portfolio.py                      # /accounts, /holdings (safety-checked; paper buys pay from cash), /portfolio…
│   │   │   ├── safety.py                         # /safety: risk profile, stock safety + AI analyzer, buy check, portfolio risk,…
│   │   │   ├── stocks.py                         # /stocks: search, quote, candles (X-Data-Source), ratios, research data,…
│   │   │   ├── targets.py                        # /targets CRUD and live PAPI evaluation (real money only); /alerts
│   │   │   └── watchlist.py                      # /watchlist CRUD with live quotes and price-alert levels
│   │   ├── safety/                               # Pure safety/risk maths plus the service that feeds it market data
│   │   │   ├── __init__.py                       # Safety features: stock safety score, risk profile, buy checks, portfolio risk…
│   │   │   ├── check.py                          # Safety check for a proposed buy, against the user's own risk rules.
│   │   │   ├── moat.py                           # Moat metrics: is the business durably protected? Pure functions over annual…
│   │   │   ├── profile.py                        # Risk-profile questionnaire and the default rules for each level.
│   │   │   ├── risk.py                           # Portfolio risk maths and stress scenarios
│   │   │   ├── score.py                          # Safety score (0–100) for a single stock.
│   │   │   └── service.py                        # Gathers market data for the pure safety maths, and applies the user's risk…
│   │   ├── __init__.py                           # Package marker
│   │   ├── analytics.py                          # Price-derived ratios computed locally from candles (no provider needed).
│   │   ├── auth.py                               # Current_user: dev mode trusts the bearer as user id; firebase mode verifies…
│   │   ├── cache.py                              # Tiny in-process TTL cache for expensive, user-independent market computations.
│   │   ├── clock.py                              # The current time, injected so cooling-off waits and holding ages can be…
│   │   ├── config.py                             # Settings from env/.env; refuses unsafe auth setups and never echoes secret…
│   │   ├── crises.py                             # How a stock behaved in bad times.
│   │   ├── crypto.py                             # Fernet encryption for user AI keys, masking, MCP token generation and hashing
│   │   ├── db.py                                 # SQLAlchemy engine/session, get_db, migrate_to_head() and the readiness schema…
│   │   ├── errors.py                             # MoatMine's exception hierarchy: every error the app raises on purpose derives…
│   │   ├── jsontypes.py                          # The one place `Any` is allowed: JSON-shaped dicts.
│   │   ├── log_config.py                         # Logging for the two entry points (API and worker): one dictConfig, JSON in…
│   │   ├── main.py                               # FastAPI app: logging, CORS, request-id middleware, routers, /mcp mount,…
│   │   ├── mcp_server.py                         # MCP server mounted at /mcp so external agents (Claude Desktop/Code, other MCP…
│   │   ├── models.py                             # SQLAlchemy tables: accounts, holdings, watchlist, notes, targets, alerts, AI…
│   │   ├── openapi_spec.py                       # Write the API's OpenAPI schema, the source the web client's types are…
│   │   ├── portfolio.py                          # Portfolio valuation shared by the API, the AI tools, the MCP server and the…
│   │   ├── ratelimit.py                          # Per-user request limits for the routes that spend paid market-data and AI…
│   │   ├── research.py                           # Research helpers shared by the API, AI tools and MCP: valuation, news feed,…
│   │   ├── rotate_keys.py                        # Re-encrypt every stored AI setting with the newest FERNET_KEY (step 2 of a…
│   │   ├── schemas.py                            # Pydantic request/response models for accounts, holdings, watchlist, notes,…
│   │   ├── seed.py                               # Demo data for local dev: python -m app.seed [user_id] (default user: dev)
│   │   ├── targets.py                            # PAPI (Profit, Amount, Period, Intent) evaluation against MAMI (min/max)…
│   │   ├── valuation.py                          # Value estimator: classic fair-value models, valuation indicators and quality…
│   │   └── worker.py                             # Background worker (Render "Background Worker" service).
│   ├── migrations/                               # Alembic environment and revisions
│   │   ├── versions/                             # One file per schema revision
│   │   │   ├── 0001_baseline_schema.py           # Baseline schema: every table as it stood when Alembic replaced create_all.
│   │   │   ├── 0002_auto_target_loss_limit.py    # Stop mirroring the loss limit into the auto target's profit floor.
│   │   │   ├── 0003_worker_heartbeat_alert_dedupe.py  # Worker heartbeat table, and one unread alert per condition enforced by a…
│   │   │   └── 0004_mcp_token_email.py           # MCP tokens remember their owner's verified email, so the allow-list can be…
│   │   ├── env.py                                # Alembic environment: runs migrations against the app's own DATABASE_URL.
│   │   └── script.py.mako                        # Template for new Alembic revisions
│   ├── tests/                                    # Pytest suite (SQLite, mock market data, no network)
│   │   ├── conftest.py                           # Test app on a throwaway SQLite DB (migrated), mock market data,…
│   │   ├── test_analytics.py                     # Price-derived ratios with hand-checkable numbers.
│   │   ├── test_api.py                           # End-to-end API: portfolio, stock data, notes, targets, worker alerts, AI…
│   │   ├── test_auth.py                          # Firebase ID token verification, with a locally generated key standing in for…
│   │   ├── test_cache.py                         # The TTL cache: expiry, eviction order, lock pruning and per-key single flight…
│   │   ├── test_config.py                        # Settings refuse dev auth on Postgres and incomplete Firebase or Fernet config
│   │   ├── test_crises.py                        # Crisis drawdown/recovery and worst-drawdown maths on hand-built bars
│   │   ├── test_crypto.py                        # Encryption round trips, tampering, masking, MCP token hashing
│   │   ├── test_db.py                            # Migrations match the models; readiness check reports DB and schema state
│   │   ├── test_dispatcher.py                    # The server-wide AI budget: per-user quotas alone don't stop many accounts…
│   │   ├── test_finnhub.py                       # Finnhub provider against canned HTTP responses (no network).
│   │   ├── test_fmp.py                           # FMP provider against canned HTTP responses (no network).
│   │   ├── test_internal.py                      # The scheduler route that starts an alert pass on hosting without background…
│   │   ├── test_llm_json.py                      # Finding the JSON object in a model reply.
│   │   ├── test_log_config.py                    # Secret redaction, JSON/text formatters, request-id middleware
│   │   ├── test_mcp_allowlist.py                 # An MCP token only works while its owner's email is on the allow-list.
│   │   ├── test_portfolio.py                     # Paper (practice) and real-money accounts are separate books everywhere money…
│   │   ├── test_ratelimit.py
│   │   ├── test_research.py                      # Company/earnings/analyst data, news feed and AI news summary
│   │   ├── test_retry.py                         # Retrying market-API GETs against canned responses (no network, no real…
│   │   ├── test_risk.py                          # Portfolio risk maths at the boundaries, with numbers you can check by hand.
│   │   ├── test_rotate_keys.py                   # FERNET_KEY rotation re-encrypts stored AI settings so the old key can be…
│   │   ├── test_safety.py                        # Safety score, risk profile, buy check, risk maths, stress tests, plans flow
│   │   ├── test_sources.py                       # Results built from fallback (sample) candles say so, however deep the candles…
│   │   ├── test_targets.py                       # PAPI evaluation never turns a missing price into a plausible-looking number.
│   │   ├── test_tools.py                         # The agent's tools hold model-supplied arguments to the same bounds as the…
│   │   ├── test_valuation.py                     # Fair-value models and quality scores with hand-checkable numbers
│   │   └── test_worker.py                        # Worker isolates a failing user; failed sector lookups count as Unknown
│   ├── .env.example                              # Every backend setting with safe local defaults (AUTH_MODE=dev, mock market…
│   ├── alembic.ini                               # Alembic CLI config; the database URL comes from app settings
│   ├── pyproject.toml                            # Ruff and mypy (strict) configuration
│   ├── pytest.ini                                # Pytest paths
│   ├── requirements-dev.txt                      # The lockfile plus pytest, ruff and mypy (pinned)
│   ├── requirements.lock                         # Exact pinned versions Render and CI install
│   └── requirements.txt                          # Direct runtime dependencies (ranges); compiled into requirements.lock
├── desktop/                                      # Tauri v2 shell that loads the static-exported web UI and calls the same API
│   ├── src-tauri/                                # Rust side of the Tauri app
│   │   ├── capabilities/
│   │   │   └── default.json                      # Main window permissions: core and opener only
│   │   ├── icons/                                # App icons for each platform
│   │   │   ├── 128x128.png
│   │   │   ├── 128x128@2x.png
│   │   │   ├── 32x32.png
│   │   │   ├── icon.icns
│   │   │   ├── icon.ico
│   │   │   └── icon.png
│   │   ├── src/                                  # Rust entry points
│   │   │   ├── lib.rs                            # Thin shell: opens the static-exported UI; no business logic
│   │   │   └── main.rs                           # Binary entry point calling lib::run()
│   │   ├── Cargo.lock                            # Pinned Rust dependencies
│   │   ├── Cargo.toml                            # Rust crate for the Tauri shell
│   │   ├── build.rs                              # Tauri-build hook
│   │   └── tauri.conf.json                       # Window, CSP (API + Firebase sign-in hosts) and bundle settings; serves web/out
│   ├── app-icon.png                              # Source image for `npm run icons`
│   ├── package-lock.json                         # Pinned npm dependencies (Tauri CLI)
│   └── package.json                              # Tauri CLI scripts: dev (over the Next dev server) and build (static export →…
├── docs/                                         # Repo map, HLD/LLD design docs and UI screenshots
│   ├── screenshots/                              # Every page and stock tab at 1400px and 390px, on mock data
│   │   ├── README.md                             # Screenshots
│   │   ├── agent-1400.png
│   │   ├── agent-390.png
│   │   ├── dashboard-1400.png
│   │   ├── dashboard-390.png
│   │   ├── dashboard-paper-1400.png
│   │   ├── dashboard-paper-390.png
│   │   ├── plans-1400.png
│   │   ├── plans-390.png
│   │   ├── portfolio-1400.png
│   │   ├── portfolio-390.png
│   │   ├── risk-1400.png
│   │   ├── risk-390.png
│   │   ├── risk-paper-1400.png
│   │   ├── risk-paper-390.png
│   │   ├── risk-profile-1400.png
│   │   ├── risk-profile-390.png
│   │   ├── settings-1400.png
│   │   ├── settings-390.png
│   │   ├── shoot.js                              # Playwright script that takes these screenshots and reports console errors and…
│   │   ├── stock-ai-1400.png
│   │   ├── stock-ai-390.png
│   │   ├── stock-analysts-1400.png
│   │   ├── stock-analysts-390.png
│   │   ├── stock-badtimes-1400.png
│   │   ├── stock-badtimes-390.png
│   │   ├── stock-financials-1400.png
│   │   ├── stock-financials-390.png
│   │   ├── stock-news-1400.png
│   │   ├── stock-news-390.png
│   │   ├── stock-notes-1400.png
│   │   ├── stock-notes-390.png
│   │   ├── stock-overview-1400.png
│   │   ├── stock-overview-390.png
│   │   ├── stock-safety-1400.png
│   │   ├── stock-safety-390.png
│   │   ├── stock-valuation-1400.png
│   │   ├── stock-valuation-390.png
│   │   ├── targets-1400.png
│   │   ├── targets-390.png
│   │   ├── watchlist-1400.png
│   │   └── watchlist-390.png
│   ├── .structure-notes.toml                     # Hand-written notes for this tree, for files that can't describe themselves
│   ├── HLD.md                                    # MoatMine — High-Level Design
│   ├── LLD.md                                    # MoatMine — Low-Level Design
│   ├── RUNBOOK.md                                # MoatMine runbook
│   └── STRUCTURE.md                              # Repository structure
├── web/                                          # Next.js UI, static-exported for GitHub Pages and the desktop app
│   ├── e2e/
│   │   └── smoke.spec.ts
│   ├── public/
│   │   └── icons/                                # App icons for the install manifest (192 and 512 px, from desktop/app-icon.png)
│   │       ├── icon-192.png
│   │       └── icon-512.png
│   ├── src/                                      # App source
│   │   ├── app/                                  # Routes (App Router): one folder per page
│   │   │   ├── agent/                            # AI agent page (ChatPanel)
│   │   │   │   └── page.tsx
│   │   │   ├── learn/
│   │   │   │   ├── page.test.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── plans/                            # Buy plans: status, cooling-off, execute or cancel
│   │   │   │   └── page.tsx
│   │   │   ├── portfolio/                        # Accounts and positions management; real/paper toggle for positions
│   │   │   │   └── page.tsx
│   │   │   ├── risk/                             # Portfolio risk tiles, sectors, correlation and stress tests; real/paper toggle
│   │   │   │   └── page.tsx
│   │   │   ├── risk-profile/                     # Risk questionnaire and editable rules
│   │   │   │   └── page.tsx
│   │   │   ├── settings/                         # AI settings, API connection, MCP tokens
│   │   │   │   └── page.tsx
│   │   │   ├── stock/                            # Stock page: chart and tabs (safety, valuation, bad times, earnings, analysts,…
│   │   │   │   └── page.tsx
│   │   │   ├── targets/                          # PAPI targets with MAMI bounds and live evaluation
│   │   │   │   └── page.tsx
│   │   │   ├── watchlist/                        # Watchlist with price alerts
│   │   │   │   └── page.tsx
│   │   │   ├── welcome/
│   │   │   │   ├── page.test.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── favicon.ico                       # Browser tab icon
│   │   │   ├── globals.css                       # Design tokens and every shared class (cards, grids, tables, buttons,…
│   │   │   ├── layout.tsx                        # Root layout: auth shell, side nav, main area
│   │   │   ├── manifest.ts                       # Web app manifest (name, icons, standalone window) so browsers offer Install…
│   │   │   └── page.tsx                          # Dashboard: totals, value chart, allocation, holdings, targets, news;…
│   │   ├── components/                           # Shared UI components
│   │   │   ├── AiSettingsCard.tsx                # Provider keys, model picker and external agent settings
│   │   │   ├── AlertsBell.tsx                    # Unread alerts popover with mark-all-read
│   │   │   ├── AllocationPie.tsx                 # Donut of holdings and cash weights
│   │   │   ├── AuthShell.tsx                     # Firebase sign-in gate (when configured) and the nav's sign-out link
│   │   │   ├── BadTimesPanel.tsx                 # Crisis drawdowns vs a benchmark and the stock's worst falls
│   │   │   ├── BookToggle.tsx                    # Real money / Paper switch and the paper-mode notice
│   │   │   ├── ChatPanel.tsx                     # Agent chat with model picker, tool use and suggestions
│   │   │   ├── LanguageSwitch.tsx
│   │   │   ├── LearnModuleView.tsx
│   │   │   ├── MoatCard.tsx                      # Moat grade: return on capital, margin stability, growth over the years
│   │   │   ├── Nav.tsx                           # Side navigation
│   │   │   ├── NewsFeed.tsx                      # News across holdings and watchlist, filterable
│   │   │   ├── PriceChart.tsx                    # Candles/line chart with ranges, SMAs and volume; labels sample data
│   │   │   ├── RatiosPanel.test.tsx
│   │   │   ├── RatiosPanel.tsx                   # Provider ratios plus price/risk stats over a chosen lookback
│   │   │   ├── ResearchPanels.tsx                # Company card, earnings, dividends, analysts and news panels
│   │   │   ├── SafetyBits.tsx                    # Grade badge, score ring and safety-check result view
│   │   │   ├── SafetyPanel.tsx                   # Stock safety report, AI analyzer and the buy check / buy plan form
│   │   │   ├── SignInForm.test.tsx
│   │   │   ├── SignInForm.tsx                    # Sign-in screen: email/password (create, reset) everywhere, Google in browsers…
│   │   │   ├── SymbolSearch.tsx                  # Debounced ticker search with a results dropdown
│   │   │   ├── ThemeSwitch.tsx
│   │   │   ├── ValuationPanel.tsx                # Fair-value models with editable assumptions
│   │   │   └── ValueChart.tsx                    # Holdings value over time for one book
│   │   ├── lib/                                  # API client, formatters and hooks
│   │   │   ├── i18n/                             # English and Hebrew: LanguageProvider/useI18n, one messages module per area,…
│   │   │   │   ├── messages/
│   │   │   │   │   ├── ai.ts
│   │   │   │   │   ├── common.ts
│   │   │   │   │   ├── dashboard.ts
│   │   │   │   │   ├── learn.ts
│   │   │   │   │   ├── risk.ts
│   │   │   │   │   ├── shell.ts
│   │   │   │   │   └── stock.ts
│   │   │   │   ├── index.test.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── messages.test.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── translate.test.ts
│   │   │   │   └── translate.ts
│   │   │   ├── learn/
│   │   │   │   ├── modules/
│   │   │   │   │   ├── assets.ts
│   │   │   │   │   ├── company.ts
│   │   │   │   │   ├── investing.ts
│   │   │   │   │   ├── markets.ts
│   │   │   │   │   ├── moatmine.ts
│   │   │   │   │   ├── portfolio.ts
│   │   │   │   │   └── risk.ts
│   │   │   │   ├── index.test.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── media.ts
│   │   │   │   ├── progress.test.ts
│   │   │   │   ├── progress.ts
│   │   │   │   └── types.ts
│   │   │   ├── api-schema.ts                     # Types generated from openapi.json (npm run gen:api); don't edit
│   │   │   ├── api.ts                            # API client (Firebase ID token or dev token), error type, and the response…
│   │   │   ├── dataSource.test.ts                # Which data-source labels count as sample data
│   │   │   ├── dataSource.ts                     # IsSampleData: whether a result's data source is the mock provider or its…
│   │   │   ├── firebase.ts                       # Firebase app and Auth from the NEXT_PUBLIC_FIREBASE_* settings; detects the…
│   │   │   ├── format.test.ts
│   │   │   ├── format.ts                         # Money, number, percent, date and tone formatters (en-US)
│   │   │   ├── theme.test.tsx
│   │   │   ├── theme.tsx
│   │   │   ├── useApi.test.ts
│   │   │   ├── useApi.ts                         # Fetch hook; ignores responses from superseded requests
│   │   │   ├── useBookMode.ts                    # Shared real/paper choice, remembered in localStorage
│   │   │   ├── useIntroSeen.test.ts
│   │   │   ├── useIntroSeen.ts
│   │   │   ├── useLearnProgress.test.ts
│   │   │   └── useLearnProgress.ts
│   │   └── copy.test.ts                          # Fails if any UI copy calls an investment safe or its returns guaranteed
│   ├── .env.example                              # API URL and (optional) Firebase web-app settings
│   ├── .gitignore                                # Next.js build output and local env files
│   ├── README.md                                 # How the web app is built, configured and exported for desktop
│   ├── eslint.config.mjs                         # ESLint flat config: Next.js core-web-vitals + typescript rules,…
│   ├── next.config.ts                            # Server build vs static export (with the GitHub Pages base path)
│   ├── openapi.json                              # The API's OpenAPI schema (python -m app.openapi_spec); CI fails if it is stale
│   ├── package-lock.json                         # Pinned npm dependencies
│   ├── package.json                              # Next.js 16 / React 19 app; scripts for dev, build and build:desktop
│   ├── playwright.config.ts
│   ├── tsconfig.json                             # TypeScript config (strict)
│   └── vitest.config.mts                         # Vitest: jsdom, React plugin, the @/ alias; tests are src/**/*.test.ts[x]
├── .ai                                           # The ogen-ai submodule: shared AI-assistant rules, agents and skills (don't…
├── .gitignore                                    # Virtualenvs, build output, local databases and env files
├── .gitmodules                                   # Points .ai at github.com/joka-7/ogen-ai
├── AGENTS.md                                     # Coding, testing, security and documentation rules for this repo (generated by…
├── CHANGELOG.md                                  # Notable changes per release (Keep a Changelog), from v0.1.0
├── CLAUDE.md                                     # Same rules as AGENTS.md, plus MoatMine's project notes, for Claude Code…
├── CONTRIBUTING.md                               # How to get a change merged: commit style, what to regenerate when, the checks…
├── LICENSE                                       # License text
├── README.md                                     # What MoatMine is, features, how to run, test and deploy it
├── ai-config.local.md                            # MoatMine-specific notes merged into AGENTS.md/CLAUDE.md by ai-sync
├── ai-config.toml                                # Manifest for ai-sync: stack, practices and targets for the generated AI config
└── render.yaml                                   # Render blueprint: one free API web service (migrates at start, /health/ready…
```
<!-- END GENERATED TREE -->
