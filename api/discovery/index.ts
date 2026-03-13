import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../lib/verifyAuth'
import { supabase } from '../lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const limit = Math.min(Number((req.query as { limit?: string }).limit) || 50, 100)
  const { data, error } = await supabase
    .from('discovery_results')
    .select('id, ticker, esc_score, esc_label, ai_thesis, signals_json, run_at')
    .order('run_at', { ascending: false })
    .limit(limit)

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  return res.status(200).json({ results: data ?? [] })
}
