# predictsim-agent

The **agent** portal — a standalone Vite + React SPA.

## Local dev
```bash
npm install
npm run dev
```
Talks to core-service (`VITE_API_BASE_URL`, default `http://localhost:3000`)
and prediction-service (`VITE_PREDICTION_API_BASE_URL`, default `http://localhost:8080`).

## Shared UI library
`src/shared/` is a **vendored copy** of the library in
[`predictsim-shared`](https://github.com/matka0369-dev/predictsim-shared).
Never edit it here — edit it there, then in each UI repo run:
```bash
SHARED_REPO=../predictsim-shared ./scripts/sync-shared.sh
```

## Deploy (Vercel)
- Framework preset: **Vite**
- Build: `npm run build`  ·  Output: `dist`
- Env: set `VITE_API_BASE_URL` / `VITE_PREDICTION_API_BASE_URL` to the deployed
  backend URLs, **or** edit `vercel.json` rewrites (`CORE_SERVICE_URL`,
  `PREDICTION_SERVICE_URL`) and point the frontend at `/api/core` + `/api/prediction`
  for a same-origin setup with no browser CORS.
