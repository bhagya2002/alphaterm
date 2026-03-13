import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createToken, setAuthCookie } from '../../api/lib/verifyAuth'
import { supabase } from '../../api/lib/supabase'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function getClientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0].trim()
  if (Array.isArray(xff)) return xff[0]?.trim() ?? 'unknown'
  return req.socket?.remoteAddress ?? 'unknown'
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appPin = process.env.APP_PIN
  if (!appPin || appPin.length !== 6) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const pin = String(body.pin ?? '').trim()

  const ip = getClientIp(req)

  try {
    const { data: lockRow } = await supabase
      .from('ip_lockouts')
      .select('failed_attempts, locked_until')
      .eq('ip', ip)
      .single()

    const lockedUntil = lockRow?.locked_until ? new Date(lockRow.locked_until) : null
    if (lockedUntil && lockedUntil > new Date()) {
      return res.status(200).json({ ok: false, lockedUntil: lockedUntil.toISOString() })
    }

    if (pin !== appPin) {
      const attempts = (lockRow?.failed_attempts ?? 0) + 1
      const lockedUntilNew = attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null

      await supabase.from('ip_lockouts').upsert(
        {
          ip,
          failed_attempts: attempts,
          locked_until: lockedUntilNew?.toISOString() ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'ip' }
      )

      if (lockedUntilNew) {
        return res.status(200).json({ ok: false, lockedUntil: lockedUntilNew.toISOString() })
      }
      return res.status(200).json({ ok: false })
    }

    await supabase.from('ip_lockouts').upsert(
      { ip, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() },
      { onConflict: 'ip' }
    )

    const token = await createToken()
    setAuthCookie(res, token)
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
