# agent

The **agent** portal — a standalone Vite + React SPA.

## Local dev
```bash
npm install
npm run dev
```
Defaults to core-service `http://localhost:3000`, prediction-service
`http://localhost:8080`. Override in `.env.local`.

## Deploy (Vercel)
- Framework preset: **Vite** · Build `npm run build` · Output `dist`
- `vercel.json` proxies `/api/core/*` and `/api/prediction/*` to the backends,
  so the browser only talks to this origin — **no CORS**, session cookie stays
  `sameSite=lax`. `.env.production` already points the app at those paths.
- If the backend URLs differ, edit them in `vercel.json`.

## Backends
- core-service (NestJS): repo `player-backend`
- prediction-service (Go): repo `go-predict`

## Shared UI library
`src/shared/` is a **vendored copy** from the monorepo
(`web/packages/shared/src`). Edit it there, then run
`./scripts/sync-shared.sh` in each portal repo.
