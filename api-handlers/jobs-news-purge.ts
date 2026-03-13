import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../api/lib/supabase'

export const config = { maxDuration: 10 }

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    await supabase.from('news_articles').delete().lt('fetched_at', cutoff.toISOString())
    await supabase.from('job_logs').insert({
      job_name: 'news_purge',
      status: 'ok',
      run_at: new Date().toISOString(),
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
