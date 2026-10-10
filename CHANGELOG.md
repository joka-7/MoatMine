# Changelog

Notable changes per release. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/). The web app, the desktop app and the
API share one version.

## [Unreleased]

### Added
- The web UI deploys to GitHub Pages; Vercel is no longer needed.
- "Install app" from Chrome and Edge, and Add to Home Screen on phones.
- Automatic releases: a new version on `main` publishes desktop installers and an Android APK.

### Changed
- Free hosting: the API runs as one free Render web service (it migrates on start), the database is
  on Neon, and an hourly GitHub workflow starts the alert pass instead of a paid background worker.
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

[0.1.0]: https://github.com/joka-7/MoatMine/releases/tag/v0.1.0
