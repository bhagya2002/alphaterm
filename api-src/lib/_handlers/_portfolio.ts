import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('is_active', true)
      .order('ticker')
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ holdings: data ?? [] })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const {
      ticker,
      company_name,
      exchange,
      market,
      account_type,
      shares,
      avg_cost,
      date_opened,
      notes,
      in_watchlist,
    } = body

    if (!ticker || !shares || shares <= 0) {
      return res.status(400).json({ error: 'ticker and shares required' })
    }

    const row = {
      ticker: String(ticker).toUpperCase(),
      company_name: String(company_name ?? ticker),
      exchange: String(exchange ?? 'US'),
      market: String(market ?? 'USD'),
      account_type: String(account_type ?? 'Personal'),
      shares: Number(shares),
      avg_cost: Number(avg_cost) ?? 0,
      date_opened: date_opened ? String(date_opened).slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: String(notes ?? ''),
      in_watchlist: Boolean(in_watchlist),
      is_active: true,
    }

    const { data, error } = await supabase.from('portfolio_holdings').insert(row).select().single()
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ holding: data })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
