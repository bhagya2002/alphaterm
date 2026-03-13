# AlphaTerm — Hosting and Running Instructions

## What to host

- **Frontend + API**: One Vercel project (React app + serverless functions in `api/`). No separate backend server.
- **Database**: One Supabase project (PostgreSQL). No self-hosted DB.
- **Cron**: Vercel Cron (configured in `vercel.json`); no separate worker.

## Prerequisites

- Node.js 18+
- npm or pnpm
- Vercel CLI (`npm i -g vercel`)
- Supabase account; create a project and get URL + anon + service_role keys.

## Local development

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables and fill in values:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and set at least: `APP_PIN`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`. Add `FINNHUB_API_KEY` and at least one LLM key when you use those features.

3. Build the API bundle and run the app with Vercel Dev (runs both the Vite frontend and the serverless API):
   ```bash
   npm run build:api
   vercel dev
   ```
   Open the URL shown (e.g. http://localhost:3000). The frontend and `/api/*` routes will work together. (The API is a single bundled file `api/index.js` built from `api-src/`.)

   Alternatively, run only the frontend (API will not work unless you proxy to a deployed API):
   ```bash
   npm run dev
   ```
   Frontend will be at http://localhost:5173. For full local behaviour use `vercel dev`.

4. Apply the Supabase schema so tables exist:
   - In the [Supabase Dashboard](https://supabase.com/dashboard), open your project → SQL Editor.
   - Paste and run the contents of `supabase/schema.sql`.

## Production (Vercel)

The API is bundled into a **single serverless function** (`api/index.js`) at build time from `api-src/`, so you stay under Vercel Hobby’s 12-function limit.

### Steps to deploy

1. **Push your code to GitHub** (or connect Vercel to your repo).

2. **Create/link the Vercel project**
   - [vercel.com](https://vercel.com) → **Add New** → **Project** → Import your repo.
   - Framework preset: **Vite**. Root: `./`. Build command and output are set in `vercel.json`.

3. **Set environment variables**
   - Project → **Settings** → **Environment Variables**.
   - Add every key from `.env.example` for **Production** (and **Preview** if you use it). Do not commit `.env.local`.
   - At minimum: `APP_PIN`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, one LLM key, one market key, and `CRON_SECRET` if you use cron.

4. **Deploy**
   - Push to `main` (or your production branch) and Vercel will run `npm run build` (which runs `build:api` then the Vite build) and deploy.
   - Or from the repo: `vercel --prod`.

5. **Cron**: In `vercel.json`, cron triggers call `/api/jobs/...` routes. Ensure `CRON_SECRET` is set in Vercel and in GitHub Actions secrets if you use the cron workflows.

## Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com). Note:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (server-side only; never expose to the client).

2. Run the schema: **SQL Editor** → run the contents of `supabase/schema.sql` (creates all tables and enables RLS).

3. RLS: Row Level Security is enabled. The API uses the **service_role** key and bypasses RLS. The client does not access the DB directly in the default setup; if you later use the anon key from the client, add policies as needed.

4. No separate “hosting” for the DB; Supabase hosts it.

## Summary

| Component        | Where it runs        |
|-----------------|----------------------|
| Frontend + API  | Vercel (one project) |
| Database        | Supabase (cloud)     |
| Cron            | Vercel Cron          |

- **Local**: `cp .env.example .env.local`, fill keys, run `vercel dev`, apply `supabase/schema.sql` in Supabase.
- **Prod**: Set all env vars in Vercel, deploy, configure cron in `vercel.json`.
