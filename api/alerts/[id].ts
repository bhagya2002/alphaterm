import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../../lib/verifyAuth'
import { supabase } from '../../lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  const id = (req.query as { id?: string }).id
  if (!id) {
    return res.status(400).json({ error: 'id required' })
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const dismissed = body.dismissed !== false
    const { error } = await supabase
      .from('alerts')
      .update({ dismissed, dismissed_at: dismissed ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
