import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../supabase'
import { verifyCron } from '../cronAuth'
import { researchOneTicker } from '../researchOneTicker'

export const config = { maxDuration: 300 }

/** Run independent research per watchlist ticker. Each gets focused analysis. */
export async function handler(req: VercelRequest, res: VercelResponse) {
  if ((req.method !== 'GET' && req.method !== 'POST') || !verifyCron(req, res)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: rows } = await supabase.from('watchlist').select('ticker')

    const tickers = [...new Set((rows ?? []).map((r) => r.ticker as string).filter(Boolean))]
    const done: string[] = []
    const failed: { ticker: string; error: string }[] = []

    for (const ticker of tickers.slice(0, 25)) {
      const r = await researchOneTicker(ticker, 'watchlist')
      if (r.ok) done.push(ticker)
      else failed.push({ ticker, error: r.error ?? 'Unknown' })
    }

    await supabase.from('job_logs').insert({
      job_name: 'watchlist_research',
      status: failed.length === 0 ? 'ok' : 'partial',
      error_message: failed.length > 0 ? failed.map((f) => `${f.ticker}: ${f.error}`).join('; ').slice(0, 500) : null,
      run_at: new Date().toISOString(),
    })

    return res.status(200).json({ ok: true, researched: done.length, failed: failed.length })
  } catch (e) {
    await supabase.from('job_logs').insert({
      job_name: 'watchlist_research',
      status: 'error',
      error_message: e instanceof Error ? e.message : String(e),
      run_at: new Date().toISOString(),
    })
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
