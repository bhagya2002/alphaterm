/**
 * Fetch news from Finnhub (and optionally Marketaux). Used by cron jobs and GET /api/news.
 */

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

export interface NewsItem {
  headline: string
  source: string
  url: string
  published_at: string
  ticker?: string
}

/** Fetch company news from Finnhub for a symbol. from/to = YYYY-MM-DD. */
export async function fetchFinnhubCompanyNews(
  symbol: string,
  from: string,
  to: string
): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${key}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as Array<{
    headline?: string
    source?: string
    url?: string
    datetime?: number
  }>
  return (data || []).map((a) => ({
    headline: a.headline ?? '',
    source: a.source ?? 'Finnhub',
    url: a.url ?? '',
    published_at: a.datetime ? new Date(a.datetime * 1000).toISOString() : new Date().toISOString(),
    ticker: symbol,
  }))
}

/** Fetch general market news from Finnhub (category optional). */
export async function fetchFinnhubMarketNews(category?: string): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  let url = `${FINNHUB_BASE}/news?token=${key}`
  if (category) url += `&category=${encodeURIComponent(category)}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as Array<{
    headline?: string
    source?: string
    url?: string
    datetime?: number
  }>
  return (data || []).map((a) => ({
    headline: a.headline ?? '',
    source: a.source ?? 'Finnhub',
    url: a.url ?? '',
    published_at: a.datetime ? new Date(a.datetime * 1000).toISOString() : new Date().toISOString(),
  }))
}

/** Date in YYYY-MM-DD for ET. */
export function todayET(): string {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return et.toISOString().slice(0, 10)
}

/** Yesterday in YYYY-MM-DD. */
export function yesterdayET(): string {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  et.setDate(et.getDate() - 1)
  return et.toISOString().slice(0, 10)
}
