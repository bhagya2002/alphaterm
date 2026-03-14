import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

/** Unified research view: recommendations + discovery + reports. Easy-to-scan list of what to buy, hold, wait for. */
export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const [
    { data: recommendations },
    { data: discovery },
    { data: reports },
  ] = await Promise.all([
    supabase.from('ai_recommendations').select('ticker, action, shares_suggested, reasoning, run_at').order('run_at', { ascending: false }).limit(30),
    supabase.from('discovery_results').select('ticker, esc_score, esc_label, ai_thesis, run_at').order('run_at', { ascending: false }).limit(50),
    supabase.from('research_reports').select('ticker, ai_score, report_json, generated_at, research_source').order('generated_at', { ascending: false }).limit(50),
  ])

  return res.status(200).json({
    recommendations: recommendations ?? [],
    discovery: discovery ?? [],
    reports: reports ?? [],
  })
}
