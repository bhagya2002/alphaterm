import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('user_preferences').select('*').eq('id', 'default').single()
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message })
    const prefs = data ?? { id: 'default', risk_tolerance: 'moderate', sector_preferences: [], target_allocation_json: null }
    return res.status(200).json(prefs)
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
    const row = {
      id: 'default',
      risk_tolerance: body.risk_tolerance ?? 'moderate',
      sector_preferences: Array.isArray(body.sector_preferences) ? body.sector_preferences : [],
      target_allocation_json: body.target_allocation_json ?? null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.setHeader('Allow', 'GET, PUT, PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
