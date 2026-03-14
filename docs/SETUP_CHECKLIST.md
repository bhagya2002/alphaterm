# AlphaTerm setup checklist

After pulling the latest code, complete these steps to use all features.

---

## 1. Run database migration

In **Supabase** → **SQL Editor**, run the contents of:

```
supabase/migrations/20250314000000_roadmap.sql
```

Or run the appended section at the bottom of `supabase/schema.sql` (from `-- Roadmap:` onwards).

This adds:

- `summary` on `news_articles`
- `target_sell_price` on `portfolio_holdings`
- `user_preferences`
- `accounts`
- `portfolio_transactions`
- `ai_recommendations`
- `research_source` on `research_reports`

---

## 2. Redeploy API

Redeploy your API (Vercel, Render, or local) so the new handlers and routes are active.

---

## 3. Redeploy frontend

Redeploy the frontend so the new UI (Portfolio target sell, Research page, etc.) is live.

---

## 4. GitHub Actions cron (optional)

Add these secrets under **Settings → Secrets and variables → Actions**:

| Secret           | Value                                                                 |
|------------------|-----------------------------------------------------------------------|
| `ALPHATERM_URL`  | Your API base URL (e.g. `https://alphaterm-api.onrender.com`), no trailing slash |
| `CRON_SECRET`    | Same value as `CRON_SECRET` in your API env vars                      |

Add `CRON_SECRET` to your API environment variables too (Render/Vercel). Use e.g. `openssl rand -hex 24` to generate.

| Cron workflow | Schedule (ET, weekdays) |
|---------------|-------------------------|
| `cron-recommendations.yml` | 6 AM, 5 PM |
| `cron-portfolio-research.yml` | 7 AM |
| `cron-watchlist-research.yml` | 8 AM |
| `cron-emerging-research.yml` | 9 AM |

**LLM providers** (set keys in API env): `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GOOGLE_AI_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `NVIDIA_NIMS_API_KEY`. Stock research prefers NVIDIA NIMS (40 req/min) for batch; other providers used for chat, fast tasks, fallback.

**Market data fallbacks** (when FMP screener/sector are restricted on your plan):
- `ALPHA_VANTAGE_KEY` — Sector rotation (free: 5 req/min). Get key: https://www.alphavantage.co/support/#api-key
- `EODHD_API_TOKEN` — Screener & Discovery (free: 20 calls/day). Get key: https://eodhd.com/register

---

## 5. New features to try

- **Portfolio**: When adding/editing a holding, set **Target sell $** (optional). The AI uses it when making recommendations—it can still suggest selling above or below if justified.
- **Research**: Unified view of recommendations, discovery, and reports. Reports are researched independently by source: portfolio (your holdings), watchlist, emerging (news, discovery candidates).
- **Settings**: Set risk tolerance and add accounts with cash balances so recommendations consider available funds.
