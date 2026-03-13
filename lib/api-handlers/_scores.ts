import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../../api/lib/verifyAuth'
import { supabase } from '../../api/lib/supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tickers = (req.query.tickers as string)?.split(',').filter(Boolean)
  let query = supabase.from('stock_scores').select('*')
  if (tickers?.length) {
    query = query.in('ticker', tickers)
  }
  const { data, error } = await query
  if (error) {
    return res.status(500).json({ error: error.message })
  }
  return res.status(200).json({ scores: data ?? [] })
}
