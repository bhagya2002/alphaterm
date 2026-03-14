import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ accounts: data ?? [] })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const { name, account_type, cash_balance, currency } = body
    if (!name) return res.status(400).json({ error: 'name required' })
    const row = {
      name: String(name),
      account_type: String(account_type ?? 'Personal'),
      cash_balance: Number(cash_balance ?? 0) || 0,
      currency: String(currency ?? 'CAD'),
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('accounts').insert(row).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ account: data })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
