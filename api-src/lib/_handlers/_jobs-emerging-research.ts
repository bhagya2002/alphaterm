import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../supabase'
import { verifyCron } from '../cronAuth'
import { researchOneTicker } from '../researchOneTicker'
import { fetchFinnhubMarketNews } from '../news'

const MAX_EMERGING = 15

/** Extract ticker symbols from news headlines (e.g. (AAPL), $$AAPL$$, or common patterns). */
function extractTickersFromHeadlines(headlines: string[]): string[] {
  const seen = new Set<string>()
  const tickers: string[] = []
  const re1 = /\$\$([A-Z]{1,5})\$\$/g
  const re2 = /\(([A-Z]{1,5})\)/g
  const re3 = /\b([A-Z]{2,5})\s+(?:stock|shares|earnings|reports)/gi

  for (const h of headlines) {
    for (const re of [re1, re2]) {
      let m: RegExpExecArray | null
      re.lastIndex = 0
      while ((m = re.exec(h)) !== null) {
        const sym = m[1].toUpperCase()
        if (sym.length >= 2 && sym.length <= 5 && !seen.has(sym)) {
          seen.add(sym)
          tickers.push(sym)
        }
      }
    }
  }
  return tickers
}

/** Run research on emerging stocks: discovery results + tickers from market news. Each gets independent analysis. */
export async function handler(req: VercelRequest, res: VercelResponse) {
  if ((req.method !== 'GET' && req.method !== 'POST') || !verifyCron(req, res)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const [
      { data: discovery },
      { data: portfolio },
      { data: watchlist },
    ] = await Promise.all([
      supabase
        .from('discovery_results')
        .select('ticker')
        .order('run_at', { ascending: false })
        .limit(30),
      supabase.from('portfolio_holdings').select('ticker').eq('is_active', true),
      supabase.from('watchlist').select('ticker'),
    ])

    const inPortfolio = new Set((portfolio ?? []).map((h) => (h.ticker as string).toUpperCase()))
    const inWatchlist = new Set((watchlist ?? []).map((w) => (w.ticker as string).toUpperCase()))

    let tickers = [...new Set((discovery ?? []).map((d) => (d.ticker as string).toUpperCase()).filter(Boolean))]

    try {
      const news = await fetchFinnhubMarketNews('general')
      const fromNews = extractTickersFromHeadlines(news.map((n) => n.headline || ''))
      tickers = [...new Set([...tickers, ...fromNews])]
    } catch {
      // ignore news fetch failure
    }

    tickers = tickers.filter((t) => !inPortfolio.has(t) && !inWatchlist.has(t)).slice(0, MAX_EMERGING)

    const done: string[] = []
    const failed: { ticker: string; error: string }[] = []

    for (const ticker of tickers) {
      const r = await researchOneTicker(ticker, 'emerging')
      if (r.ok) done.push(ticker)
      else failed.push({ ticker, error: r.error ?? 'Unknown' })
    }

    await supabase.from('job_logs').insert({
      job_name: 'emerging_research',
      status: failed.length === 0 ? 'ok' : 'partial',
      error_message: failed.length > 0 ? failed.map((f) => `${f.ticker}: ${f.error}`).join('; ').slice(0, 500) : null,
      run_at: new Date().toISOString(),
    })

    return res.status(200).json({ ok: true, researched: done.length, failed: failed.length })
  } catch (e) {
    await supabase.from('job_logs').insert({
      job_name: 'emerging_research',
      status: 'error',
      error_message: e instanceof Error ? e.message : String(e),
      run_at: new Date().toISOString(),
    })
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
