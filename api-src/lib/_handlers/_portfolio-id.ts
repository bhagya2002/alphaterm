import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  const id = (req.query as { id?: string }).id
  if (!id) {
    return res.status(400).json({ error: 'id required' })
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const allowed = ['ticker', 'company_name', 'exchange', 'market', 'account_type', 'shares', 'avg_cost', 'target_sell_price', 'date_opened', 'notes', 'in_watchlist', 'account_id']
    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k]
    }
    if (updates.ticker) updates.ticker = String(updates.ticker).toUpperCase()
    if (typeof updates.shares === 'number' && updates.shares <= 0) {
      return res.status(400).json({ error: 'shares must be positive' })
    }
    const { data, error } = await supabase
      .from('portfolio_holdings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ holding: data })
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('portfolio_holdings')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'DELETE, PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
