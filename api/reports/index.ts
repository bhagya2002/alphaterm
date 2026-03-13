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

  const ticker = (req.query.ticker as string)?.toUpperCase()
  if (!ticker) {
    return res.status(400).json({ error: 'ticker required' })
  }

  const { data, error } = await supabase
    .from('research_reports')
    .select('*')
    .eq('ticker', ticker)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ report: data })
}
