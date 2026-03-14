import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  const id = (req.query as { id?: string }).id
  if (!id) return res.status(400).json({ error: 'id required' })

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = String(body.name)
    if (body.account_type !== undefined) updates.account_type = String(body.account_type)
    if (body.cash_balance !== undefined) updates.cash_balance = Number(body.cash_balance) || 0
    if (body.currency !== undefined) updates.currency = String(body.currency)
    const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ account: data })
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('accounts').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
