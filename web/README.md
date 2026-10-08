# MoatMine web

The MoatMine UI: Next.js 15 (App Router) with React 19. It is one codebase built two ways:

- `npm run build` is the Vercel deployment.
- `npm run build:desktop` is a static export to `out/` that the Tauri app in `../desktop` loads.

Both call the same FastAPI backend (`../backend`).

## Run

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, optional NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
npm install
npm run dev                  # http://localhost:3000, against the API on :8000
npx tsc --noEmit             # type check
```

## Auth

- With `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set, the app sits behind Clerk sign-in and every API call carries Clerk's session token (`authToken()` in `src/lib/api.ts`).
- Without it, the app runs in local dev mode: the API must run `AUTH_MODE=dev`, and the user id comes from Settings.
- The static export can't ship `@clerk/nextjs`'s server parts, so `next.config.ts` swaps in `@clerk/react` for that build only.

## Where things are

Pages are in `src/app/<route>/page.tsx`. Shared components are in `src/components/`. The API client, formatters and hooks are in `src/lib/`.

[`../docs/STRUCTURE.md`](../docs/STRUCTURE.md) has the full file map. [`../docs/screenshots/`](../docs/screenshots/) has every page at desktop and phone width.
