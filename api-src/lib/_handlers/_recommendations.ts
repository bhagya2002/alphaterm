import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

/** GET latest AI recommendations. */
export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const limit = Math.min(Number((req.query as { limit?: string }).limit) || 20, 50)
  const { data, error } = await supabase
    .from('ai_recommendations')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(limit)
  if (error) return res.status(500).json({ error: error.message })
  const runAt = (data ?? [])[0]?.run_at ?? null
  return res.status(200).json({ recommendations: data ?? [], run_at: runAt })
}
