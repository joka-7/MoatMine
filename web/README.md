# MoatMine web

The MoatMine UI: Next.js 16 (App Router, Turbopack) with React 19. It is one codebase built two ways:

- `npm run build:desktop` is a static export to `out/`. The Tauri app in `../desktop` loads it, and `.github/workflows/pages.yml` publishes it to GitHub Pages with `NEXT_BASE_PATH=/<repo>`.
- `npm run build` is the server build, for hosts like Vercel.

Both call the same FastAPI backend (`../backend`).

## Run

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, optional NEXT_PUBLIC_FIREBASE_* settings
npm install
npm run dev                  # http://localhost:3000, against the API on :8000
npx tsc --noEmit             # type check
```

## Auth

- With the `NEXT_PUBLIC_FIREBASE_*` settings, the app sits behind Firebase sign-in (`src/components/SignInForm.tsx`: email and password, plus Google in a browser) and every API call carries the user's Firebase ID token (`authToken()` in `src/lib/api.ts`).
- Without them, the app runs in local dev mode: the API must run `AUTH_MODE=dev`, and the user id comes from Settings.

## Where things are

Pages are in `src/app/<route>/page.tsx`. Shared components are in `src/components/`. The API client, formatters and hooks are in `src/lib/`.

[`../docs/STRUCTURE.md`](../docs/STRUCTURE.md) has the full file map. [`../docs/screenshots/`](../docs/screenshots/) has every page at desktop and phone width.
