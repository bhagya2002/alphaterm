import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from './lib/verifyAuth'
import { supabase } from './lib/supabase'
import { fetchFinnhubCompanyNews, todayET } from './lib/news'

const CACHE_TTL_MINUTES = 5

/** Check if we have fresh cache for tickers (any article fetched in last CACHE_TTL_MINUTES). */
async function hasFreshCache(tickers: string[]): Promise<boolean> {
  const cutoff = new Date()
  cutoff.setMinutes(cutoff.getMinutes() - CACHE_TTL_MINUTES)
  const cutoffIso = cutoff.toISOString()
  const { data } = await supabase
    .from('news_articles')
    .select('id')
    .in('ticker', tickers)
    .gte('fetched_at', cutoffIso)
    .limit(1)
  return (data?.length ?? 0) > 0
}

/** Fetch from Finnhub and insert into news_articles for cache. Skip if same ticker+headline exists. */
async function fetchAndStore(tickers: string[]): Promise<void> {
  const from = todayET()
  for (const ticker of tickers.slice(0, 20)) {
    const articles = await fetchFinnhubCompanyNews(ticker, from, from)
    for (const art of articles.slice(0, 10)) {
      const { data: existing } = await supabase
        .from('news_articles')
        .select('id')
        .eq('ticker', ticker)
        .eq('headline', art.headline)
        .limit(1)
      if ((existing?.length ?? 0) > 0) continue
      await supabase.from('news_articles').insert({
        ticker,
        headline: art.headline,
        source: art.source,
        url: art.url,
        published_at: art.published_at,
      })
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tickersParam = (req.query.tickers as string) || ''
  const tickers = tickersParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)

  if (tickers.length === 0) {
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(30)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ articles: data ?? [] })
  }

  const hasCache = await hasFreshCache(tickers)
  if (!hasCache) {
    await fetchAndStore(tickers).catch(() => {})
  }

  const { data, error } = await supabase
    .from('news_articles')
    .select('*')
    .in('ticker', tickers)
    .order('published_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ articles: data ?? [] })
}
