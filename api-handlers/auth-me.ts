import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const ok = await verifyAuth(req, res)
  if (!ok) return
  return res.status(200).json({ ok: true })
}
