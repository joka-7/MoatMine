---
name: add-logging
description: Add or fix logging in code using the project's language-idiomatic structured logger (Python `logging`, Go `slog`, Rust `tracing`, Kotlin SLF4J, Swift `os.Logger`, TS/JS `pino`). Use when the user asks to add logging, replace `print`/`console.log`, make logs structured, or review logging quality — even if they just say "this needs better logs".
---

# Add Logging

Add a deliberate logging plan to the target code, following the language's logging rule in `AGENTS.md`.

## Steps

1. Detect the language and the logger already in use (`grep` for `logging`, `slog`, `tracing`, `pino`, `winston`, `print`, `console.log`). Reuse the existing logger and config; never introduce a second one.
2. Find the places that need logs: entry points, external I/O (HTTP, DB, queues), state transitions, retries/fallbacks, and every `except`/`catch`/error-return that is handled rather than propagated.
3. Replace ad-hoc `print`/`console.log`/`println` with the project logger. Use one logger per module (Python: `logging.getLogger(__name__)`).
4. Pick levels deliberately: `DEBUG` diagnostics, `INFO` business events, `WARNING` recoverable anomalies, `ERROR` failed operations. Not everything is `INFO`.
5. Attach context as fields (IDs, counts, durations), not prose. Use request-scoped context (`contextvars`, MDC, child loggers, `slog.*Context`) so it propagates.
6. On errors, log the exception object with its stack trace (`logger.exception`, `err` field, throwable arg) **once**, where it is handled — not at every layer it passes through.
7. Libraries emit only; the application entry point owns handler/level/format config (JSON in production). Add or fix that config if missing.
8. Run the project's lint/type/test commands.

## Rules

- Never log secrets, tokens, credentials, or PII. Redact or omit.
- No logging inside tight loops without sampling or a `DEBUG` guard.
- Don't change behavior: logging must not alter control flow or swallow exceptions.
- Don't rewrite log lines that are already structured and correct.

## Output

Summarize what was added or changed per file, the level choices that aren't obvious, and anything deliberately left unlogged.
