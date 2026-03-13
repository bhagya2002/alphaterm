import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'
import { supabase } from '../api/lib/supabase'

interface EarningsTranscriptRow {
  id?: string
  ticker: string
  call_date: string | null
  source: string | null
  source_url: string | null
  summary_text: string | null
  sentiment_label: string | null
  cached_at?: string
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tickerParam =
    (req.method === 'GET' ? (req.query.ticker as string) : (req.body as any)?.ticker) || ''
  const ticker = tickerParam.toUpperCase().trim()
  if (!ticker) {
    return res.status(400).json({ error: 'ticker required' })
  }

  // Phase 4: Earnings call transcript analysis is stubbed until a free transcript API is configured.
  const { data, error } = await supabase
    .from<EarningsTranscriptRow>('earnings_transcripts')
    .select('*')
    .eq('ticker', ticker)
    .order('call_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Non-fatal; still return stub message
    return res.status(200).json({
      message: 'Transcript analysis coming soon.',
      status: 'stub',
    })
  }

  if (!data) {
    return res.status(200).json({
      message: 'Transcript analysis coming soon.',
      status: 'stub',
    })
  }

  return res.status(200).json({
    summary: data,
    status: 'ok',
  })
}

