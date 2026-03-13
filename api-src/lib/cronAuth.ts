import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Verify cron requests. Vercel Cron can send CRON_SECRET in Authorization header.
 * Call from job handlers; returns true if authorized, else sends 401 and returns false.
 */
export function verifyCron(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // No secret configured: allow (for local dev). In prod set CRON_SECRET.
    return true
  }
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-cron-secret'] as string | undefined
  if (token !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

/** Return true if current time is a weekday in ET. */
export function isWeekdayET(): boolean {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  return day >= 1 && day <= 5
}

/** Return true if current ET time is within market hours (e.g. 9:30–16:00). */
export function isMarketHoursET(): boolean {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hour = et.getHours()
  const minute = et.getMinutes()
  const mins = hour * 60 + minute
  return mins >= 9 * 60 + 30 && mins < 16 * 60
}
