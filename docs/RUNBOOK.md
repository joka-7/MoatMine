# MoatMine runbook

What to do when something goes wrong in production (Render: the free `moatmine-api` service from
`render.yaml`; the database on Neon; the daily alert pass started by `.github/workflows/alerts.yml`). Each step names the file, command or endpoint it relies
on. Anything this repo can't confirm is marked **Check** — it depends on your Render or Neon plan.

## Health signals

| Signal | Where | Healthy | Unhealthy means |
|---|---|---|---|
| `GET /health` | API | `{"ok": true}` | The process is down or not routing |
| `GET /health/ready` | API; Render's deploy health check (`healthCheckPath`) | `{"ok": true, "database": "ok"}` | 503 `unreachable`: Postgres down or out of connections. 503 `schema behind the code`: a migration didn't run |
| `GET /health/worker` | API, reads `worker_heartbeats` | `ok: true`, `age_seconds` under 3 × `WORKER_INTERVAL_SECONDS` (90 000 s in `render.yaml`, so 75 hours: a weekend doesn't trip it) | 503: the alert worker hasn't finished a pass recently. `users_failed > 0`: some users' alerts failed (see the worker logs) |

Point an external uptime monitor at `/health/ready` and `/health/worker`; nothing in this repo pages anyone.

Logs are JSON in production (`LOG_FORMAT=json`). Every API log line carries `request_id`, also
returned to clients in the `X-Request-ID` header — ask users for it when they report an error.

## Stuck or failing alert pass

Symptom: `/health/worker` returns 503, or alerts stop appearing.

1. GitHub → Actions → **Alert pass**: did it run on the last weekday (14:47 UTC), and is it green?
   - Red with "Set the repository variable API_URL and the secret ALERTS_RUN_TOKEN": set them.
   - Red with HTTP 401: the GitHub secret and Render's `ALERTS_RUN_TOKEN` differ. 404: Render has
     no `ALERTS_RUN_TOKEN`.
   - Red after the retries: the API didn't wake or is down. Check `/health/ready` and Render.
   - You can start a pass by hand with **Run workflow**.
2. Open the `moatmine-api` logs in Render.
   - `worker pass done, N new alerts` every interval: it is running. If `/health/worker` still
     says stale, the heartbeat write is failing. Look for database errors.
   - `worker: alerts failed for one user` with a traceback: one user's data or a provider call is
     failing. Other users are unaffected (`app/worker.py` commits per user). Fix the cause; the
     next pass retries.
   - `worker pass failed`: the whole pass failed, usually the database. Check `/health/ready`.
   - `alert pass failed` with a traceback: the background task itself failed.
3. Restarting the service or re-running the workflow is safe at any time. Alerts are de-duplicated
   by the `uq_alerts_unread_dedupe` index, so an overlapping or repeated pass can't double-alert.

## Upstream outage (Finnhub, FMP, AI vendors)

- **Finnhub or FMP returning 429/5xx.** Calls retry 3 times with jittered backoff
  (`app/market/retry.py`). Past that:
  - quotes that still fail mark holdings `stale` (priced at cost) and the dashboard says so;
  - `/stocks/*` routes that need a price return 502 with the reason;
  - Finnhub candles fall back to sample data, labelled `mock-fallback` in every result built on them.
  Nothing to do but wait, or check the provider's status page and your plan's limits.
- **A Finnhub 401/403.** The key is wrong or the endpoint isn't on your plan. Retries don't help
  (`app/market/retry.py` treats them as final). Check `FINNHUB_API_KEY` in the
  `moatmine-shared` env group.
- **Running with no market data at all.** Set `MARKET_PROVIDER=mock` in the env group and
  redeploy. Every view then labels its numbers as sample data.
- **AI vendor down or out of credit.** ModelDispatcher falls back across vendors and keys. When
  nothing is left the chat returns `no_provider_available` (503). When all users together have
  used `AI_SERVER_TOKENS_PER_DAY` on the server's keys, server keys stop until UTC midnight and
  only users' own keys work. Raise the cap or add a key.

## Rolling back a deploy

The start command runs `alembic upgrade head` before the server, and `/health/ready` fails while the database
revision differs from the code's newest migration (`schema_is_current` in `app/db.py`). So the
order matters:

1. **If the bad deploy added no migration**, roll back in Render (the service's Deploys page →
   an earlier deploy → Rollback) for `moatmine-api`.
2. **If it added migrations**, downgrade the database first, using the code that is deployed
   now (it is the only code that knows how to undo its migrations):
   ```bash
   # Render Shell on moatmine-api
   alembic history | head          # find the revision the previous release used
   alembic downgrade <revision>    # e.g. 0002
   ```
   Then roll back both services. Older code can't run `alembic upgrade head` against a database
   at a revision it doesn't know: the start command fails and the deploy stops.
3. Downgrades lose what the newer schema added. `0003` drops `worker_heartbeats`; read-marked
   duplicate alerts stay read. `0002` restores the auto target's old `profit_min` from each risk
   profile.

## Database backup and restore

- **Check:** how far back your Neon plan lets you restore the database (Neon calls it the restore
  window or history retention). Within that window, restore from the Neon console.
- **Logical backup** you control, before risky changes (a migration, a key rotation):
  ```bash
  pg_dump --format=custom --no-owner "$DATABASE_URL" > moatmine-$(date +%F).dump
  ```
  Restore into an empty database:
  ```bash
  pg_restore --no-owner --dbname "$NEW_DATABASE_URL" moatmine-YYYY-MM-DD.dump
  ```
  Point `DATABASE_URL` at it, then run `alembic upgrade head` (a no-op if the dump was current).
- A backup is only as good as `FERNET_KEY`: without the key that encrypted it, every saved user
  AI key in `ai_settings` is unreadable. Store the key with the backups' access controls, not in
  the dump.

## `FERNET_KEY` custody and rotation

`FERNET_KEY` encrypts users' AI provider keys and external-agent keys (`app/crypto.py`,
`ai_settings.encrypted_config`). Nothing else uses it.

- **Custody.** Keep it only in the `moatmine-shared` env group (`sync: false`) and a password
  manager or secret store your team controls. It must never be committed or logged. The API
  refuses to start in firebase mode without a valid key (`app/config.py`).
- **Lost key.** The encrypted settings can't be recovered. Set a new key, then ask users to
  re-enter their AI keys in Settings → AI. Accounts, holdings, plans and targets are not
  affected.
- **Rotation** (scheduled, or if the key may have leaked):
  1. Generate a key: `python -c "from app.crypto import new_key; print(new_key())"`.
  2. Set `FERNET_KEY=<new>,<old>` in the env group and redeploy. The first key encrypts;
     both decrypt (`MultiFernet`).
  3. Re-encrypt the stored settings with the new key (Render Shell on `moatmine-api`):
     `python -m app.rotate_keys`. It rewrites every row in one transaction and fails without
     committing anything if a row can't be decrypted.
  4. Set `FERNET_KEY=<new>` and redeploy. Saved keys still load in Settings → AI.
  If the old key leaked, also ask users to rotate the provider keys themselves: whoever had the
  old key and a copy of the database could already read them.

## Secrets that come from elsewhere

| Secret | Where it lives | If it leaks |
|---|---|---|
| `FIREBASE_*` | Firebase console | Nothing secret here: the API holds only the project id, and the web the public web-app settings. Protect the Firebase console account itself (two-factor sign-in) |
| `FINNHUB_API_KEY`, `FMP_API_KEY`, `*_API_KEY` (AI) | The provider's dashboard | Regenerate there, update the env group, redeploy |
| MCP tokens | `mcp_tokens` (hashes only) | Users revoke them in Settings → AI |
