# Screenshots

Every page and every stock tab at 1400px (desktop) and 390px (phone) wide, plus the dashboard and
Risk page with the **Paper** book selected. Data is the mock provider (sample prices, labelled as
such in the UI) and the `dev` user from `python -m app.seed`, plus one paper buy of 5 MSFT.

`<page>-<width>.png`; stock tabs are `stock-<tab>-<width>.png` for AAPL.

## Regenerate

```bash
cd backend && alembic upgrade head && python -m app.seed && uvicorn app.main:app --port 8000
cd web && npm run build && npx next start -p 3000
NODE_PATH=$(npm root -g) node docs/screenshots/shoot.js docs/screenshots   # needs Playwright + Chromium
```

The script also prints console errors, failed API calls and horizontal overflow for each shot;
every line should read `ok`.
