import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  const holdingId = (req.query as { holding_id?: string }).holding_id

  if (req.method === 'GET') {
    let q = supabase.from('portfolio_transactions').select('*').order('transacted_at', { ascending: false })
    if (holdingId) q = q.eq('holding_id', holdingId)
    const { data, error } = await q.limit(200)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ transactions: data ?? [] })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const { holding_id, type, shares, price, fee, transacted_at, notes } = body
    if (!holding_id || !type || !shares || shares <= 0 || !price || price <= 0) {
      return res.status(400).json({ error: 'holding_id, type (buy/sell), shares (>0), price (>0) required' })
    }
    if (!['buy', 'sell'].includes(String(type))) {
      return res.status(400).json({ error: 'type must be buy or sell' })
    }
    const row = {
      holding_id,
      type: String(type),
      shares: Number(shares),
      price: Number(price),
      fee: Number(fee ?? 0) || 0,
      transacted_at: transacted_at ? String(transacted_at).slice(0, 19) : new Date().toISOString().slice(0, 19),
      notes: notes ? String(notes) : null,
    }
    const { data: tx, error } = await supabase.from('portfolio_transactions').insert(row).select().single()
    if (error) return res.status(500).json({ error: error.message })

    const { data: holding } = await supabase.from('portfolio_holdings').select('shares, avg_cost').eq('id', holding_id).single()
    if (holding) {
      let newShares = Number(holding.shares)
      let newAvgCost = Number(holding.avg_cost)
      if (type === 'buy') {
        const totalCost = newShares * newAvgCost + Number(shares) * Number(price)
        newShares += Number(shares)
        newAvgCost = newShares > 0 ? totalCost / newShares : 0
      } else {
        newShares = Math.max(0, newShares - Number(shares))
        newAvgCost = newShares > 0 ? newAvgCost : 0
      }
      await supabase.from('portfolio_holdings').update({
        shares: newShares,
        avg_cost: newAvgCost,
        updated_at: new Date().toISOString(),
      }).eq('id', holding_id)
    }
    return res.status(200).json({ transaction: tx })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
