# Changelog

Notable changes per release. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/). The web app, the desktop app and the
API share one version.

## [Unreleased]

### Security
- **Action needed before deploying:** set `ALLOWED_EMAILS` (comma-separated) in Render. In firebase mode the API now only lets in accounts with a verified email on that list (403 otherwise) and refuses to start without it; `ALLOW_ANY_USER=true` is the explicit opt-out. MCP tokens remember their owner's email (migration 0004) and stop working when it leaves the list; tokens made before this must be recreated.

### Changed
- Charts and the numbers built on them use real daily, weekly and monthly prices from FMP when Finnhub's plan has no candles and `FMP_API_KEY` is set. Intraday ranges still show sample data.

### Fixed
- Hebrew no longer shows English for the sentences the API sends. Safety flags, grades and notes, check results, crisis names and descriptions, stress scenarios, valuation notes, alerts, plan and error messages are translated in the app (`web/src/lib/i18n/serverText.he.json`; a sentence nobody translated still shows in English). The AI safety analysis and news summary now answer in the chosen language (`language=he` on `/stocks/{symbol}/safety/analyze` and `/stocks/{symbol}/news/summary`). A backend test fails if the API starts sending a sentence with no Hebrew entry. Real news headlines, company descriptions and the AI provider names stay as the providers write them.

### Added
- Settings → "Sync with Google Drive (optional)" on the website: backs up the on-device data to one file in the user's hidden Drive app folder and merges it into other devices that sync (later edit wins per record; a deletion reaches the others; AI keys are never included). It needs a Google sign-in, the Google Drive API enabled in the project, and is not available in the desktop and Android apps yet. The logic is tested against a fake Drive; it has not been run against a real Google account.
- "Move my data from the server to this device" in Settings: shows what the server holds, offers a backup file, copies real-money accounts, positions, plans, watchlist, notes, targets, alerts and the risk profile onto the device, reads every record back, and only then offers to delete the server copy. Practice (paper) accounts are not copied and are deleted with the rest. New API routes `GET /me/data` and `DELETE /me/data`; AI settings and MCP tokens are not touched.
- With the on-device switch on, the dashboard's value-over-time chart works again: it values the holdings kept on the device from daily prices fetched by symbol. It was hidden before. A failure to fetch prices now shows an error instead of an empty chart.
- With the on-device switch on, AI keys are saved on the device and the AI chat runs in the app: it calls your AI provider straight from the browser, and its 21 tools read your portfolio, risk rules, targets, watchlist and notes from the device. The server only serves market data for the symbols looked up; it no longer sees your keys or your questions. Write tools still act only on a symbol you named. Needs `modeldispatcher-browser-agent` 0.7 (tool calling).
- With the on-device switch on, the app checks for alerts itself (the server worker cannot see data kept on the device): when it opens, then every 15 minutes while it stays open. It covers watchlist price thresholds, target breaches, position and sector limits, and the loss limit (skipped on sample prices). Nothing is checked while the app is closed; local notifications are a later step. The value-history and target-message maths are ported to TypeScript and checked against the Python on shared vectors.
- With the on-device switch on, buy plans are kept and run on the device: the check, the written reason and cooling-off rules, the re-check at execution and the thesis note are the same as on the server. Only the real-money book is available there.
- With the on-device switch on, the Risk page (portfolio risk and stress test) is computed in the app from the book on the device and daily prices and crisis history fetched by symbol. The risk maths (alignment, beta, correlation, VaR, drawdown, stress scenarios) is ported to TypeScript and checked against the Python on shared vectors.
- With the on-device switch on, your risk profile and rules are saved on the device too, and adding a position runs the safety check in the app (the stock's own score still comes from the API by symbol). The check and the profile's level rules are ported to TypeScript and checked against the Python on shared vectors. If the check cannot run, the position is still saved and the page says why.
- Targets (PAPI/MAMI) can also be kept on the device: with the Settings switch on they are saved there and evaluated in the app against the on-device portfolio, using a year of daily prices fetched by symbol. Volatility is computed in the app (checked against the Python on shared vectors) and is shown as unknown when only sample prices exist.
- The on-device switch in Settings now also keeps real-money accounts and positions on the device: the dashboard and Portfolio page value them from the device's records plus live quotes by symbol. Paper accounts, the value chart and the add-position safety check stay server-only for now.
- Portfolio valuation and target (PAPI/MAMI) evaluation ported to TypeScript (`web/src/lib/calc/`), checked against the Python on shared test vectors (`backend/tests/vectors/calc.json`). Not used by any screen yet; groundwork for keeping the whole portfolio on the device.
- Settings → "Keep my data on this device": an opt-in switch that stores the watchlist and stock notes in this browser or app instead of on the server, with export and import of one JSON file. Off by default; the other screens still use the server.
- On-device portfolio store (`web/src/lib/store/`): typed collections over IndexedDB, validated JSON export/import and merge rules. Not wired to any screen yet; the first step of keeping the portfolio on the user's device (see `docs/LOCAL-FIRST.md`).
- Google sign-in in the desktop and Android apps, through the system browser, once a Google OAuth client is configured (see the README). Until then the apps keep offering email and password only.

## [0.4.0] - 2026-10-21

### Added
- A light (daylight) view: Light, Dark or Match device in Settings and on the sign-in screen. Dark stays the default.
- Learn lessons link to short outside videos and podcasts (English, and Hebrew where one exists). They open in a new tab on the author's own site.

### Changed
- When sign-ups are closed, trying to create an account (or sign in with Google as a new user) says so instead of showing an error code.

## [0.3.0] - 2026-10-19

### Added
- A welcome tour for first-time users: six steps on what MoatMine does, shown once and replayable
  from Settings.
- Learn pages: seven beginner finance modules in English and Hebrew, from what investing is to how
  MoatMine checks risk. Every lesson has expandable more details and three worked examples, and a
  module can be marked complete.
- End-to-end smoke tests (Playwright) in CI, run against the real API and the static export.

## [0.2.0] - 2026-10-11

### Added
- The web UI deploys to GitHub Pages; Vercel is no longer needed.
- "Install app" from Chrome and Edge, and Add to Home Screen on phones.
- Automatic releases: a new version on `main` publishes desktop installers and an Android APK.
- Hebrew: a language switch in Settings and on the sign-in screen. Hebrew lays the app out right to
  left, and the AI agent answers in Hebrew. Texts the server writes (safety-check reasons, alerts)
  are still in English.

### Changed
- Free hosting: the API runs as one free Render web service (it migrates on start), the database is
  on Neon, and a GitHub workflow starts the alert pass each trading day after the US open instead of a paid background worker.
- Sign-in moved from Clerk to Firebase Authentication (email and password, plus Google in
  browsers), like the other apps. Existing Clerk accounts don't carry over: users sign up again.

## [0.1.0] - 2026-10-08

The first tagged release: the version the first desktop builds are cut from.

### Added
- Safety score with A–F area grades, red flags and an AI analyzer; a risk-profile questionnaire
  with editable rules; a safety check on every buy, with buy plans, written reasons and
  cooling-off.
- Portfolio risk (volatility, beta, VaR, concentration, correlation, rule breaches) and stress
  tests through past crises and market falls.
- Paper (practice) accounts as a separate book from real money, with a toggle on the dashboard,
  Portfolio and Risk pages.
- PAPI targets with MAMI bounds; worker alerts for targets, watch prices, concentration and the
  loss limit (a fall from the 1-year high).
- Valuation (eight models), bad-times history, ratios, earnings, analysts, dividends and news.
- A tool-using AI agent through ModelDispatcher, and the same read tools over MCP.
- Clerk sign-in for the web and the desktop export (desktop sign-in not yet tried against a
  live Clerk instance), per-user rate limits, a server-wide daily AI budget, and `FERNET_KEY`
  rotation.
- Alembic migrations, CI (lint, types, tests, both web builds, `cargo check`, drift checks for
  the repo map and the generated API types), and the README, HLD, LLD, RUNBOOK and CONTRIBUTING
  docs.

### Security
- The web app runs on Next.js 16.3.8 (PostCSS, cache-poisoning and SSRF advisories in earlier
  versions).
- The external-agent URL must resolve to a public address; agent write tools act only on a
  symbol the user named; the desktop's production CSP has no `'unsafe-inline'` scripts.

[0.4.0]: https://github.com/joka-7/MoatMine/releases/tag/v0.4.0
[0.3.0]: https://github.com/joka-7/MoatMine/releases/tag/v0.3.0
[0.2.0]: https://github.com/joka-7/MoatMine/releases/tag/v0.2.0
[0.1.0]: https://github.com/joka-7/MoatMine/releases/tag/v0.1.0
