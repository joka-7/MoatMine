## Why

<!-- The problem this solves, or the backlog item / issue it closes. -->

## What changed

<!-- The behaviour a user or operator will notice. The diff shows the code. -->

## How it was verified

<!-- Commands run and their result; screenshots for UI changes (desktop and phone width). Say what you couldn't verify. -->

## Checklist

- [ ] Tests cover the change (a failing test first, for a bug fix)
- [ ] Docs updated in the same PR (README, `docs/HLD.md`, `docs/LLD.md`, `docs/RUNBOOK.md`)
- [ ] Migration added and reviewed, if `app/models.py` changed
- [ ] `web/openapi.json` and `web/src/lib/api-schema.ts` regenerated, if a response model changed
- [ ] Sample data is labelled; no copy calls an investment safe or its returns guaranteed
