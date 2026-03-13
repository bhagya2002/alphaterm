import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from './lib/verifyAuth'
import { supabase } from './lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .order('added_at', { ascending: false })
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ watchlist: data ?? [] })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const { ticker, company_name, exchange, market, notes } = body
    if (!ticker) {
      return res.status(400).json({ error: 'ticker required' })
    }
    const row = {
      ticker: String(ticker).toUpperCase(),
      company_name: String(company_name ?? ticker),
      exchange: String(exchange ?? 'US'),
      market: String(market ?? 'USD'),
      notes: String(notes ?? ''),
      alert_enabled: false,
    }
    const { data, error } = await supabase.from('watchlist').insert(row).select().single()
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ entry: data })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
