import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../lib/verifyAuth'
import { supabase } from '../lib/supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(50)
  if (error) {
    return res.status(500).json({ error: error.message })
  }
  return res.status(200).json({ alerts: data ?? [] })
}
