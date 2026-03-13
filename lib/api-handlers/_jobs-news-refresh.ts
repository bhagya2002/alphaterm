import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/lib/supabase'
import { verifyCron, isWeekdayET, isMarketHoursET } from '../../api/lib/cronAuth'
import { runInference } from '../../api/lib/inferenceRouter'
import { getPrompt } from '../../api/lib/prompts'
import { fetchFinnhubCompanyNews, todayET } from '../../api/lib/news'

export const config = { maxDuration: 120 }

/** Classify sentiment (BULLISH/BEARISH/NEUTRAL) via fast LLM. */
async function classifySentiment(headline: string): Promise<number | null> {
  const prompt = getPrompt('news_sentiment_classify', headline)
  try {
    const result = await runInference({
      taskType: 'news_sentiment_classify',
      prompt,
    })
    const text = (result.text || '').trim().toUpperCase()
    if (text.includes('BULLISH')) return 1
    if (text.includes('BEARISH')) return -1
    return 0
  } catch {
    return null
  }
}

/** If ticker has alert_enabled on watchlist and sentiment is negative, fire alert. */
async function maybeFireSentimentAlert(ticker: string, sentimentScore: number | null, headline: string): Promise<void> {
  if (sentimentScore == null || sentimentScore > -0.5) return
  const { data: w } = await supabase.from('watchlist').select('id').eq('ticker', ticker).eq('alert_enabled', true).limit(1)
  if ((w?.length ?? 0) === 0) return
  await supabase.from('alerts').insert({
    ticker,
    alert_type: 'news_sentiment',
    message: `Negative sentiment: ${headline.slice(0, 80)}${headline.length > 80 ? '…' : ''}`,
  })
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!verifyCron(req, res)) return

  let provider = ''
  let tokensApprox = 0
  try {
    if (!isWeekdayET() || !isMarketHoursET()) {
      await supabase.from('job_logs').insert({
        job_name: 'news_refresh',
        status: 'skipped',
        error_message: 'Outside market hours',
        run_at: new Date().toISOString(),
      })
      return res.status(200).json({ ok: true, skipped: 'outside market hours' })
    }

    const { data: holdings } = await supabase.from('portfolio_holdings').select('ticker').eq('is_active', true)
    const { data: watchlist } = await supabase.from('watchlist').select('ticker')
    const tickers = [...new Set([...(holdings ?? []).map((h) => h.ticker), ...(watchlist ?? []).map((w) => w.ticker)])]
    if (tickers.length === 0) {
      await supabase.from('job_logs').insert({
        job_name: 'news_refresh',
        status: 'ok',
        run_at: new Date().toISOString(),
      })
      return res.status(200).json({ ok: true, tickers: 0 })
    }

    const from = todayET()
    const to = todayET()
    let totalTokens = 0
    const inserted: { ticker: string; id?: string }[] = []

    for (const ticker of tickers.slice(0, 15)) {
      const articles = await fetchFinnhubCompanyNews(ticker, from, to)
      for (const art of articles.slice(0, 5)) {
        const existing = await supabase
          .from('news_articles')
          .select('id')
          .eq('ticker', ticker)
          .eq('headline', art.headline)
          .limit(1)
        if ((existing.data?.length ?? 0) > 0) continue

        const sentiment = await classifySentiment(art.headline)
        totalTokens += 50
        const { data: row } = await supabase
          .from('news_articles')
          .insert({
            ticker,
            headline: art.headline,
            source: art.source,
            url: art.url,
            sentiment_score: sentiment,
            published_at: art.published_at,
          })
          .select('id')
          .single()
        if (row) inserted.push({ ticker, id: row.id })
        await maybeFireSentimentAlert(ticker, sentiment, art.headline)
      }
    }

    await supabase.from('job_logs').insert({
      job_name: 'news_refresh',
      status: 'ok',
      provider_used: provider || null,
      tokens_approx: totalTokens,
      run_at: new Date().toISOString(),
    })
    return res.status(200).json({ ok: true, tickers: tickers.length, articles_inserted: inserted.length })
  } catch (e) {
    console.error(e)
    await supabase.from('job_logs').insert({
      job_name: 'news_refresh',
      status: 'error',
      provider_used: provider || null,
      tokens_approx: tokensApprox || null,
      error_message: e instanceof Error ? e.message : String(e),
      run_at: new Date().toISOString(),
    })
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
