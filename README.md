# predictsim-agent

The **agent** portal — a standalone Vite + React SPA.

## Local dev
```bash
npm install
npm run dev
```
Defaults to core-service on `http://localhost:3000` and prediction-service
on `http://localhost:8080`. Override with `VITE_API_BASE_URL` /
`VITE_PREDICTION_API_BASE_URL` in a `.env.local`.

## Deploy (Vercel)
- Framework preset: **Vite** · Build `npm run build` · Output `dist`
- `vercel.json` rewrites `/api/core/*` and `/api/prediction/*` to the Render
  backends, so the browser only ever talks to this origin — **no CORS**, and
  the session cookie stays `sameSite=lax`.
- `.env.production` already points the app at those proxy paths. If Render
  gives your services different names, edit the two URLs in `vercel.json`.

## Shared UI library
`src/shared/` is a **vendored copy** of
[`predictsim-shared`](https://github.com/matka0369-dev/predictsim-shared).
Edit it there, then here:
```bash
SHARED_REPO=../predictsim-shared ./scripts/sync-shared.sh
```
