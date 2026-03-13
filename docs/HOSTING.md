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

3. Run the app with Vercel Dev (runs both the Vite frontend and the serverless API):
   ```bash
   vercel dev
   ```
   Open the URL shown (e.g. http://localhost:3000). The frontend and `/api/*` routes will work together.

   Alternatively, run only the frontend (API will not work unless you proxy to a deployed API):
   ```bash
   npm run dev
   ```
   Frontend will be at http://localhost:5173. For full local behaviour use `vercel dev`.

4. Apply the Supabase schema so tables exist:
   - In the [Supabase Dashboard](https://supabase.com/dashboard), open your project → SQL Editor.
   - Paste and run the contents of `supabase/schema.sql`.

## Production (Vercel)

1. Push your code to GitHub (or connect Vercel to your repo).

2. In Vercel: **New Project** → Import your repo → set Framework preset to **Vite** → Root directory `./` (or where the app lives).

3. **Environment variables**: In the project → **Settings** → **Environment Variables**, add every key from `.env.example` for **Production** (and **Preview** if you want). Do not commit `.env.local`.

4. Deploy:
   ```bash
   vercel --prod
   ```
   Or rely on Vercel’s automatic deploys on push.

5. **Cron**: In `vercel.json`, cron triggers are defined to call `/api/jobs/...` routes. Vercel Hobby includes cron; ensure the routes exist and are protected (e.g. by cron secret header).

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
