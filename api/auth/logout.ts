import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearAuthCookie } from '../lib/verifyAuth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  clearAuthCookie(res)
  return res.status(200).json({ ok: true })
}
