import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'

/**
 * Reddit sentiment stub. No free public API for r/investing or r/CanadianInvestor
 * that returns structured sentiment; RSS exists but would require parsing and no key.
 * Return stub so frontend can call without error.
 */
export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(200).json({
    source: 'reddit',
    sentiment: null,
    message: 'Reddit sentiment not configured. No free API available for r/investing or r/CanadianInvestor.',
    subreddits: ['r/investing', 'r/CanadianInvestor'],
  })
}
