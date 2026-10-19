# MoatMine — Low-Level Design

Contracts and the logic that isn't obvious, as built. Each section names the
[HLD](HLD.md) decision it implements rather than repeating it.

## Class / interface contracts

| Contract | Kind | Implementations / users | Implements (HLD) |
|---|---|---|---|
| `MarketProvider` (`app/market/base.py`) | `Protocol`: `quote`, `candles`, `metrics`, `news`, `profile`, `search`, `company`, `earnings`, `recommendations`, `price_target`, `dividends`, `splits`, `fundamentals`, `history` | `MockProvider`, `FinnhubProvider`, `RoutedProvider` (primary + optional `FMPProvider`) | Static view: market data; NFR: runs without keys |
| `Quote`, `Candle`, `NewsItem` | `TypedDict` | Returned by every provider | Data validation / I/O |
| `Rules`, `Candidate`, `Book` (`app/safety/check.py`) | frozen dataclasses | Input to the pure `check_buy` | Functional: buy check |
| `StockFacts` (`app/safety/score.py`) | frozen dataclass | Input to the pure `safety_score` | Functional: safety score |
| `Assumptions` (`app/valuation.py`) | dataclass | Input to the pure `estimate` | Functional: research |
| `BookMode = Literal["real", "paper"]` (`app/portfolio.py`) | type | Every portfolio-shaped function, route and tool | Functional: real and paper books |
| `JSONDict` (`app/jsontypes.py`) | alias, `dict[str, Any]` | Report and provider dicts. The only `Any` in the app | Data validation / I/O |
| ORM models (`app/models.py`) | SQLAlchemy 2.0 `Mapped` | Routers and services through a `Session` | Data storage |
| `useI18n()` → `{lang, setLang, t}` (`web/src/lib/i18n/index.tsx`) | React context from `LanguageProvider` | Every screen; `t(key, vars)` fills `{name}` placeholders and throws on a missing one. Outside a provider it renders English | Functional: English and Hebrew |
| `MessageKey` (`web/src/lib/i18n/messages.ts`) | union of every module's `en` keys | Each `messages/<area>.ts` types its `he` against its `en`, so a missing Hebrew text fails `tsc` | Functional: English and Hebrew |
| `LearnModule`, `Lesson`, `Question`, `Localized` (`web/src/lib/learn/types.ts`) | interfaces; `Localized = Record<Lang, string>` | Lesson text in `web/src/lib/learn/modules/*.ts`, listed in `LEARN_MODULES` | Functional: Learn pages; a missing Hebrew text fails `tsc` |
| `Progress` (`web/src/lib/learn/progress.ts`) | `Record<moduleId, best quiz score>` | `useLearnProgress` reads and writes it under `moatmine.learn`; pure `parseProgress` drops anything malformed. A module is complete at `passMark` (two thirds of its quiz, rounded up) | Functional: Learn pages |

The business logic takes a `MarketProvider` argument. The concrete provider comes from the
`get_provider()` composition point (see DI wiring).

## Pseudocode

**Buy check sizing** (`check_buy`, `app/safety/check.py`). A buy is paid from the book's cash
first, and only the remainder counts as new money:

```
after_total = book.total_value + amount - min(amount, max(book.cash, 0))
position %  = (book.by_symbol[symbol] + amount) / after_total
sector %    = (book.by_sector[sector] + amount) / after_total
fail  if score < min_safety_score, distress flag, penny flag (unless allowed), position % > limit
warn  if no score, sector % > limit, volatility > limit, market cap < minimum, price > 1.15 × fair value
verdict = block if any fail, else warn if any warn, else pass
```

**Loss limit** (`loss_limit_breach`, `app/safety/check.py`). `max_drawdown_pct` is a fall from
the peak, not a return against cost, so it is not mirrored into the auto target's `profit_min`
(migration `0002` clears the old values):

```
values = daily value of today's real holdings over 365 days (held_value_history)
fall % = (values[-1] / max(values) - 1) * 100
breach if fall % < max_drawdown_pct        (both negative; exactly at the limit is not a breach)
```

**Data-source labelling** (`app/market/sources.py`):

```
track_sources():  push a new set onto a ContextVar stack; yield it; pop
note_source(s):   add s to every set on the stack   (nested trackers all see it)
source_label(name, used) = "mock-fallback" if "mock-fallback" in used else name
```

`FinnhubProvider.candles` calls `note_source("mock-fallback")` when it falls back. The stack
lives in a ContextVar, and `asyncio.gather` children share the parent's sets, so concurrent
requests never see each other's sources.

**Worker pass** (`app/worker.py`):

```
for user in all users with targets, watch items or a risk profile (sorted):
    try:
        n = alerts_for_user(user)    # risk-rule concentration (real book), PAPI targets (real book), watch levels
        commit; created += n
    except Exception:
        rollback; log with user_id; continue
_emit: insert only if no *unread* alert with the same (user, dedupe_key), inside a savepoint;
       the unique partial index rejects a duplicate from an overlapping pass (counted as not new)
record_heartbeat(finished_at, duration, created, failed)   # only for a pass that wasn't stopped
```

**Plan state machine** (`app/routers/safety.py`):

```
create:  verdict block → blocked
         verdict warn  → note must be ≥ 20 chars (else 422) → cooling_off until now + cooling_off_hours
         verdict pass  → ready
cooling_off is shown as ready once available_at has passed (_plan_out)
execute: must be ready → claim: UPDATE … SET status='executing' WHERE status = observed
         (rowcount ≠ 1 ⇒ 409: a concurrent request got there first)
         → re-check → block ⇒ status blocked, 409
                    → drifted pass→warn ⇒ note ≥ 20 chars: cooling_off again, 409; else cancelled, 409
         → paper: pay_for_paper_buy (409 if cash is short) → holding + thesis note → executed
         any error before that releases the claim back to the observed status
cancel:  any status except executed
```

**Startup config guard** (`app/config.py`):

```
Settings._auth_is_safe:
    dev   and DATABASE_URL starts with "postgres"     → error
    firebase and FIREBASE_PROJECT_ID isn't a Firebase project id → error
get_settings(): ValidationError → ConfigError(reasons only, no values), raised from None
```

## I/O schemas

Response models (`QuoteOut`, `CandleOut`, `RatiosOut`, `CheckResultOut`, `PlanOut`, `ChatOut`,
`ModelChoiceOut`, plus the `*Out` models for stored records) are in `app/schemas.py`; the web's
types for them are generated (`web/openapi.json` → `web/src/lib/api-schema.ts`).

Request bodies are the Pydantic models in `app/schemas.py`, plus three defined in routers:
- `ProfileIn`, `CheckIn`, `PlanIn` in `routers/safety.py`
- `AISettingsIn` in `routers/ai.py`

Important ones:

| Endpoint | Request | Response (key fields) |
|---|---|---|
| `GET /portfolio?mode=real\|paper` | — | `{mode, accounts[], holdings[{symbol, quantity, avg_cost, price, value, pnl, pnl_pct, weight_pct, stale}], totals{cash, invested_value, net_worth, cost, pnl, pnl_pct, day_change}}` |
| `POST /safety/check` | `{symbol, amount \| quantity, mode}` (exactly one of amount/quantity) | `{verdict, risky, requires_note, cooling_off_hours, checks[{rule, status, message}], mode, safety{score, grade, flags}, price}` |
| `GET /safety/portfolio?mode=` | — | `{mode, total_value, volatility_pct, beta, var95_1d, var95_1m, max_drawdown_pct, sectors{}, correlation{symbols, matrix}, breaches[], rules{}, data_source}` |
| `GET /safety/stress?mode=` | — | `{mode, total_value, loss_limit_pct, betas{}, scenarios[{key, name, kind, change, change_pct, worst[], holdings[], breaches_limit}], data_source, note, as_of}` |
| `POST /plans` / `POST /plans/{id}/execute` | `{account_id, symbol, quantity, note}` | `{id, status, verdict, available_at, check, executed_holding_id, …}`; 409 = blocked or short of cash, 422 = reason needed |
| `GET /stocks/{s}/candles` | `resolution, start, end` | `Candle[]` + header `X-Data-Source` |
| `GET /portfolio/history` | `days, mode` | `{t, value}[]` (last close carried forward over gaps, from the first day every holding has a price) + header `X-Data-Source` |
| `GET /stocks/{s}/ratios` | `lookback_days` | `{fundamental, price, data_source}` |
| `GET /health` / `GET /health/ready` | — | `{ok}` / `{ok, database}` (ready returns 503 if the DB is unreachable or behind) |
| `POST /internal/alerts/run` | bearer `ALERTS_RUN_TOKEN` | 202 `{status: "started" \| "already running"}`; 401 wrong token; 404 when no token is configured |
| `GET /health/worker` | — | `{ok, last_pass, age_seconds, duration_seconds, alerts_created, users_failed}`; 503 when no pass has finished or the last is over 3 × `WORKER_INTERVAL_SECONDS` old |
| `POST /ai/chat` | `{messages[{role: "user"\|"assistant", content}], model, symbol?, language: "en"\|"he"}` (the agent answers in `language`) | `{model, content, tools_used[]}`, or ModelDispatcher's error payload with its HTTP status |

Agent and MCP tools are listed in `TOOL_SPECS` (`app/ai/tools.py`) as JSON Schema. The
portfolio-shaped tools take `mode`. Each spec has an explicit `read_only` flag: the in-app agent
gets every tool, and `app/mcp_server.py` registers only the read-only ones, wrapping each in a
typed function chosen by its argument shape (`_SHAPES`); a new shape with no wrapper fails at import.

## Config keys

Read in `app/config.py` `Settings`, through `get_settings()` (cached once per process).

| Key | Default | Read by |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./moatmine.db` | `app/db.py` (engine; `postgres://` is rewritten to `postgresql+psycopg://`) |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT_SECONDS` | 5 / 5 / 10 | `app/db.py` `_make_engine` (Postgres only) |
| `AUTH_MODE` | `dev` (`dev`\|`firebase`) | `app/auth.py` |
| `FIREBASE_PROJECT_ID` | `""` (required in firebase mode) | `app/auth.py` `current_user`: the token's `aud` and `iss` must name it |
| `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` | localhost:3000 + Tauri origins | `app/main.py` |
| `MARKET_PROVIDER` | `mock` | `app/market/__init__.py` `get_provider` (finnhub only when `FINNHUB_API_KEY` is set) |
| `FINNHUB_API_KEY`, `FMP_API_KEY` | `""` | `get_provider` |
| `FERNET_KEY` | `""` (required to save AI keys; comma-separated during a rotation, newest first) | `app/crypto.py` (`MultiFernet`), `app/rotate_keys.py` |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` | `""` | `app/ai/dispatcher.py` (server keys) |
| `AI_REQUESTS_PER_MIN`, `AI_TOKENS_PER_MIN`, `AI_TOKENS_PER_DAY` | 20 / 60 000 / 1 000 000 | `dispatcher._tenant` |
| `AI_TIMEOUT_SECONDS` | 90 | `dispatcher._run` |
| `AI_SERVER_TOKENS_PER_DAY` | 5 000 000 (0 = no cap) | `dispatcher._registry`: once all users together reach it, server keys stop being offered until UTC midnight |
| `WORKER_INTERVAL_SECONDS` | 300 (90 000 in `render.yaml`: a day plus an hour, so 3× covers a weekend without runs) | `app/worker.py` loop; `/health/worker` staleness |
| `ALERTS_RUN_TOKEN` | `""` (route off; at least 32 characters when set) | `app/routers/internal.py`: bearer for `POST /internal/alerts/run` |
| `RATE_LIMIT_MARKET_PER_MIN`, `RATE_LIMIT_AI_PER_MIN` | 240 / 30 | `app/ratelimit.py`: per user, on `/stocks/*`, `/news/feed`, stock safety (market) and chat or the safety analyzer (AI) |
| `LOG_LEVEL`, `LOG_FORMAT` | `INFO`, `text` (`json` in `render.yaml`) | `app/log_config.py` via the entry points |

Web: `NEXT_PUBLIC_API_URL` (`web/src/lib/api.ts`) and `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` (`web/src/lib/firebase.ts`).

## DI wiring

- **Database session.** `get_db` (`app/db.py`) is a FastAPI dependency in every router. Two other
  places open `SessionLocal()` directly:
  - the worker;
  - the MCP server, because MCP tools run outside FastAPI's dependency system.
- **Blocking database access.** The session is synchronous SQLAlchemy. Async code (routes, services,
  agent tools, MCP, worker) runs every query, commit, flush and lazy relationship load through
  `asyncio.to_thread`, so a slow Postgres round-trip doesn't stall other requests on the event
  loop. Sync (`def`) routes already run in FastAPI's threadpool.
- **Current user.** `current_user` (`app/auth.py`) is a dependency on every user-scoped route.
- **Market provider.** `get_provider()` is an `lru_cache` singleton built from settings. Every route
  receives it as `provider: MarketProvider = Depends(get_provider)` and passes it down to services
  as a `MarketProvider` argument.
- **Clock.** Plan routes and target evaluation take the time from `get_clock` (`app/clock.py`);
  tests override it to move through cooling-off waits and holding periods. `evaluate` takes `now`
  explicitly; the worker and agent tools pass `utc_now()`.
  - Tests swap it with `app.dependency_overrides[get_provider]`, or pass a fake straight to a
    service.
  - Agent tools, the MCP server and the worker run outside FastAPI's dependency system and call
    `get_provider()` themselves.
- **AI.** `dispatcher.provider_factory` and `external_factory` are module-level factories. Tests
  monkeypatch them (`tests/conftest.py` `fake_ai`).
  - `dispatcher` is transport only: `routers/ai.py` builds the tool registry
    (`app.ai.tools.registry`) and passes it to `dispatcher.chat`. Domain modules (`research.py`,
    `safety/service.py`) import `dispatcher.complete` normally, with no import cycle.
- **Logging.** Configured only in the entry points: `app/main.py` at import, and the
  `__main__` blocks of `app/worker.py` and `app/seed.py`.

## Error contract

Every error the app raises on purpose derives from `MoatMineError` (`app/errors.py`). The HTTP
mapping lives in one place: the exception handlers in `app/main.py`.

| Exception | Raised by | HTTP |
|---|---|---|
| `ConfigError` | `get_settings()` on invalid or unsafe settings | never served: the process doesn't start |
| `InsufficientPaperCashError` | `pay_for_paper_buy` | 409, mapped in the route so the body can include the safety check |
| `MarketDataError` | providers with no usable value (e.g. Finnhub's `c=0` quote) | 502 (`market_data_missing` handler) |
| `DispatchError(status, payload)` | `app/ai/dispatcher.py` around ModelDispatcher | its own status and payload (`dispatch_failed` handler) |

Other errors:
- **HTTP errors** use FastAPI `HTTPException`:
  - 401: auth failed. Token failures say only `invalid token`.
  - 404: not found or not owned.
  - 409: state conflict.
  - 422: validation.
- **Provider errors** propagate as `httpx` errors. Where a fallback is deliberate, it is caught
  narrowly and logged with `describe_error` (type and status, never the message, because the
  message contains the URL):
  - FMP falls back to the primary provider.
  - A failed or empty quote marks the holding `stale`. Totals list it under `unpriced`, the buy
    check warns, and PAPI targets report `no_data` instead of 0% P/L.
  - A failed sector lookup counts as `Unknown`.
  - Failed candles leave volatility unknown for target alerts.
- **AI tool arguments** that break the bounds come back to the model as
  `{"error": "invalid arguments", ...}`, not as an exception.

## Logging plan

- **Setup** (`app/log_config.py`): one `dictConfig`. JSON lines in production; text with extras
  appended locally.
  - Every record gets `request_id`: the caller's `X-Request-ID` if it is well formed, otherwise
    a UUID. `app/main.py` `tag_request` sets it and echoes it in the response header.
  - The `httpx`, `httpcore` and `alembic` loggers run at WARNING.
  - Every formatted line passes through `redact` (`token=`, `apikey=`, `api_key=`).
- **WARNING** for every degraded path, with `symbol` and `status_code`/`error` in `extra`:
  - FMP fallback;
  - failed quote or news call;
  - failed sector lookup;
  - candles falling back to sample data;
  - candles failing in `risk_by_symbol`;
  - a worker pass with failed users.
- **ERROR (`logger.exception`):**
  - a worker failure for one user, with `user_id` (an opaque auth id, not PII);
  - a whole worker pass failing;
  - readiness finding the database unreachable.
- **INFO:** each worker pass's alert count, and seed progress.
- **DEBUG:** Finnhub endpoints the plan doesn't include.
- **Never logged:** request or response bodies, API keys, tokens, or portfolio contents.
- **Not implemented:** an error sink such as Sentry, and metrics.

## Unit test plan

Tests follow arrange–act–assert, with parametrized cases per contract. Mocks sit only at true
I/O boundaries (HTTP transport, LLM vendor, JWKS).

| Contract | Tests | Boundary faked |
|---|---|---|
| `check_buy`, `safety_score`, risk/stress, moat, profile | `test_safety.py` (hand-checkable numbers, including cash-funded sizing) | none (pure) |
| `estimate` and the valuation models | `test_valuation.py` | none (pure) |
| `crisis_stats`, `worst_drawdowns` | `test_crises.py` | none (pure) |
| Real/paper books across snapshot, risk, stress, history, check, worker, agent tools; paper cash | `test_portfolio.py` | none (SQLite + mock provider) |
| Data-source labelling (nested, concurrent) | `test_sources.py`, `test_finnhub.py` | `httpx.MockTransport` |
| Finnhub/FMP mapping and errors; FMP fallback logging | `test_finnhub.py`, `test_fmp.py` | `httpx.MockTransport` |
| `current_user` (Firebase ID token: valid, expired, wrong issuer, key or project, missing claims, HS256) | `test_auth.py` | JWKS client → local RSA key |
| `Settings` safety guard, `ConfigError` without values | `test_config.py` | none |
| Encryption, masking, token hashing, key rotation | `test_crypto.py`, `test_rotate_keys.py` | none |
| Migrations match models; readiness | `test_db.py` | `ScriptDirectory.get_heads` / `schema_is_current` |
| Buy plans: create, execute, cancel, cooling-off (fake clock), concurrency, re-check drift | `test_safety.py` | `get_clock` override |
| PAPI period against a given clock | `test_targets.py` | none |
| Worker isolation; sector failure tolerance; loss-limit alert; heartbeat; SIGTERM; unread-alert index | `test_worker.py` | provider wrappers (one raises, one falls) |
| Logging redaction, formatters, request id | `test_log_config.py` | none |
| TTL cache expiry, eviction order, lock pruning (fake clock) | `test_cache.py` | none |
| Price ratios (returns, volatility, drawdown, SMA, RSI) by hand | `test_analytics.py` | none |
| Beta, correlation, portfolio risk and stress scenarios at the boundaries | `test_risk.py` | none |
| Paper cash, failed quotes, value history over gaps | `test_portfolio.py` | none |
| Upstream retry and backoff | `test_retry.py` | `httpx.MockTransport` |
| Web: sample-data detection, `useApi` superseded responses, Ratios sample label, UI copy never promising safety (English and Hebrew), sign-in errors, i18n (placeholders, Hebrew covers English, language switch sets `<html dir>`), number formatting isolated left to right | `web/src/**/*.test.ts[x]` (vitest + Testing Library, jsdom) | `@/lib/api` / `@/lib/useApi` mocked |
| Chat, tools, MCP, settings, news summary | `test_api.py`, `test_research.py` | ModelDispatcher `MockProvider` |
