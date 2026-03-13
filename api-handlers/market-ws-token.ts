import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'

/**
 * Returns Finnhub API key for client-side WebSocket connection (free tier allows WS with same key).
 * Only exposed to authenticated user.
 */
export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.FINNHUB_API_KEY
  if (!token) {
    return res.status(503).json({ error: 'Finnhub not configured' })
  }
  return res.status(200).json({ token })
}
