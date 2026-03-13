import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'
import { supabase } from '../api/lib/supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  const id = (req.query as { id?: string }).id
  if (!id) {
    return res.status(400).json({ error: 'id required' })
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

  res.setHeader('Allow', 'DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
