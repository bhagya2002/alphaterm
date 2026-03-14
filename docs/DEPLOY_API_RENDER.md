# Deploy AlphaTerm API on Render (free)

Use this when the frontend stays on **Vercel** and the API runs on **Render** (avoids Vercel’s 12-function limit and 405 issues).

## 1. Create the API service on Render

1. Go to [render.com](https://render.com) and sign in (GitHub is fine).
2. **Dashboard** → **New** → **Web Service**.
3. Connect your GitHub repo (the one that has `alphaterm`).
4. Use these settings:

   | Field | Value |
   |-------|--------|
   | **Name** | `alphaterm-api` (or any name) |
   | **Region** | Choose closest to you |
   | **Branch** | `main` |
   | **Runtime** | Node |
| **Build Command** | `npm install && npm run build:api` (builds `api/index.cjs`) |
| **Start Command** | `node server/index.cjs` |
   | **Instance Type** | Free |

5. Click **Advanced** and add **Environment Variables**. Copy from your `.env.example` / `.env.local` and add at least:

   - `APP_PIN`
   - `JWT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - One LLM key (e.g. `GROQ_API_KEY`)
   - One market key (e.g. `FINNHUB_API_KEY`)
   - **`CORS_ORIGIN`** = `https://alphaterm.vercel.app` (your Vercel frontend URL)
   - **`COOKIE_SAMESITE`** = `None` (required for cross-origin cookies)

6. Create the Web Service. Render will build and deploy. Note the URL (e.g. `https://alphaterm-api.onrender.com`).

## 2. Point the frontend at the API

In **Vercel** (your frontend project):

1. **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `VITE_API_URL`
   - **Value:** your Render API URL **without** a trailing slash (e.g. `https://alphaterm-api.onrender.com`)
   - **Environment:** Production (and Preview if you use it)
3. **Redeploy** the frontend (trigger a new deployment so the new env var is applied).

## 3. Test

- Open `https://alphaterm.vercel.app`.
- Log in with your `APP_PIN`. The request goes to the Render API; the cookie is set with `SameSite=None` so it works cross-origin.

## 4. Optional: run the API locally

```bash
npm run build:api
PORT=3001 node server/index.cjs
```

Then set `VITE_API_URL=http://localhost:3001` when running the frontend (e.g. `npm run dev`) to hit the local API.

## Notes

- **Free tier:** Render may spin down the service after ~15 min of no traffic; the first request after that can be slow (cold start).
- **Cron / GitHub Actions:** If you use cron jobs that call the API, point them at the Render URL (e.g. `https://alphaterm-api.onrender.com/api/jobs/...`) and send the same `CRON_SECRET` header.
