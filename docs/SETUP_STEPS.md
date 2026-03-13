# AlphaTerm — Complete setup steps

Follow these in order to get AlphaTerm running locally and on Vercel.

---

## 1. Prerequisites

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **Git**
- **Vercel CLI** (optional): `npm i -g vercel`
- **Accounts**: Supabase (free), and at least one market data + one LLM provider (see step 3)

---

## 2. Clone and install

```bash
git clone <your-repo-url> alphaterm
cd alphaterm
npm install
```

---

## 3. Environment variables and API keys

1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```

2. **Required (minimum to run)**:
   - `APP_PIN` — 6-digit PIN you’ll use to log in (e.g. `123456`)
   - `JWT_SECRET` — At least 32 characters. Generate with: `openssl rand -base64 32`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` — from your Supabase project (step 4)
   - At least **one LLM key** (e.g. `GROQ_API_KEY` or `CEREBRAS_API_KEY`) so reports and cron jobs can run
   - At least **one market key** (e.g. `FINNHUB_API_KEY`) for prices and news

3. **Get API keys** — open these in your browser to sign up and create keys:
   - **Supabase**: https://supabase.com/dashboard
   - **Finnhub**: https://finnhub.io/register
   - **Alpha Vantage**: https://www.alphavantage.co/support/#api-key
   - **FMP**: https://site.financialmodelingprep.com/developer/docs
   - **Polygon**: https://polygon.io/dashboard/signup
   - **NewsAPI**: https://newsapi.org/register
   - **Marketaux**: https://www.marketaux.com/
   - **Groq**: https://console.groq.com/
   - **Cerebras**: https://cloud.cerebras.ai/
   - **Google AI**: https://aistudio.google.com/app/apikey
   - **OpenRouter**: https://openrouter.ai/keys
   - **Mistral**: https://console.mistral.ai/
   - **GitHub token** (for GitHub Models): https://github.com/settings/tokens
   - **FRED** (macro): https://fred.stlouisfed.org/docs/api/api_key.html

   Bank of Canada and SEC EDGAR do **not** require keys (see .env.example).

4. **Cron (production only)**  
   Set `CRON_SECRET` to a long random string. Vercel will send it when calling your cron endpoints. Generate with: `openssl rand -hex 24`

---

## 4. Supabase database

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In the project: **Settings → API** — copy **Project URL** → `SUPABASE_URL`, **anon public** → `SUPABASE_ANON_KEY`, **service_role** → `SUPABASE_SERVICE_KEY`.
3. **SQL Editor** → New query → paste the **entire** contents of `supabase/schema.sql` → Run.
4. Confirm tables exist (e.g. `portfolio_holdings`, `watchlist`, `job_logs`, `pre_market_briefs`, `eod_reports`, `evening_digests`, `overnight_briefs`, etc.).

---

## 5. Run locally

1. Start the app (Vercel runs both frontend and API):
   ```bash
   vercel dev
   ```
   Or frontend only: `npm run dev` (API routes won’t work unless you use `vercel dev`).

2. Open the URL shown (e.g. http://localhost:3000).
3. Enter your `APP_PIN` and use the app.

---

## 6. Deploy to Vercel (production)

1. Push your code to **GitHub** (or GitLab/Bitbucket).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your repo.
3. **Framework preset**: Vite. **Root**: `./` (or where the app lives). **Build command**: `npm run build`. **Output**: `dist`.
4. **Environment variables**: In the project → **Settings → Environment Variables**, add **every** variable from `.env.example` for **Production** (and **Preview** if you want). Do **not** commit `.env.local`.
5. **Deploy**: Click Deploy, or run `vercel --prod` from the repo root (after `vercel link`).
6. Set **CRON_SECRET** in Vercel to the same value you use to secure cron (see step 3). Cron requests will send this so your job handlers can verify them.

---

## 7. Cron jobs (schedule and models)

Cron runs on Vercel’s schedule (all times **Eastern**, weekdays unless noted).

| Time (ET)     | Job              | Description |
|---------------|------------------|-------------|
| 2:00 AM       | overnight-prep   | Overnight headlines → brief for next day (fast model: Groq 8B). |
| 9:05 AM       | discovery/run    | FMP screener + ESC scoring (reasoning model). |
| 9:10 AM       | pre-market       | Pre-market brief (fast: Groq 8B). |
| 9:30–4:00 PM  | news-refresh     | Every 30 min: news + sentiment (fast). |
| 3:45 PM       | eod-report       | End-of-day report (reasoning: Cerebras 70B). |
| 6:00 PM       | evening-digest   | Evening digest (reasoning). |
| 8:00 PM       | news-refresh     | After-hours news refresh. |
| 11:00 PM      | news-purge       | Delete news older than 7 days (daily). |

**Models used (free tier):**

- **Fast** (pre-market, news sentiment, overnight): **Groq Llama 3.1 8B** or Cerebras 8B.
- **Reasoning** (reports, EOD, evening digest): **Cerebras Llama 3.3 70B** or OpenRouter DeepSeek-R1.
- **Chat**: **Google Gemini 2.0 Flash** (best UX, 20/day) or fallbacks.

---

## 8. Prompts from `.cursor/Prompts`

These are wired into the app:

- **deep_dive_analyst** — Fundamental & earnings report (report style `deep_dive`).
- **quant_technical** — Technical & quant memo (report style `quant`).
- **macro_sector_strategy** — Macro/sector briefing (available for sector reports).
- **chief_investment_officer** — Portfolio stress test & IPS (report style `cio`).

When generating a report (Stock page or API), you can pass `style: 'full' | 'deep_dive' | 'quant' | 'cio'` to use the corresponding prompt.

---

## 9. Private repo and Vercel

**Can my repo be private and still work with Vercel?**

- **Vercel Hobby (free)**: Only **public** GitHub/GitLab/Bitbucket repos can be connected. Private repos are **not** supported on the free plan.
- **Vercel Pro** (paid): You **can** connect **private** repos. So yes, a private repo works with Vercel **if you use a paid Vercel plan** (e.g. Pro).

**Options:**

1. Use a **public** repo on the Hobby plan (your env vars and Supabase data stay private; only code is public).
2. Upgrade to **Vercel Pro** and connect your **private** repo.
3. Deploy from the CLI with `vercel --prod` without linking to a Git provider; the repo can stay private, but you won’t get automatic deploys on push (you’d run `vercel --prod` manually).

---

## 10. Checklist summary

- [ ] Node 18+, Git, (optional) Vercel CLI
- [ ] Repo cloned, `npm install` run
- [ ] `.env.local` created from `.env.example`
- [ ] `APP_PIN`, `JWT_SECRET`, Supabase URL/keys set
- [ ] At least one LLM key and one market key set
- [ ] Supabase project created, `schema.sql` run
- [ ] Local run: `vercel dev` → open app → log in with PIN
- [ ] Vercel project created, env vars added, deploy done
- [ ] `CRON_SECRET` set in Vercel if using cron
- [ ] If repo is private: use Vercel Pro or deploy via CLI only

For more on hosting and run commands, see [HOSTING.md](./HOSTING.md).
