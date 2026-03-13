import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = process.env.FMP_API_KEY
  if (!key) {
    return res.status(503).json({ error: 'FMP_API_KEY not configured' })
  }

  const q = req.query as Record<string, string | undefined>
  const params = new URLSearchParams({ apikey: key })
  if (q.market_cap_min) params.set('marketCapMoreThan', q.market_cap_min)
  if (q.market_cap_max) params.set('marketCapLowerThan', q.market_cap_max)
  if (q.volume_min) params.set('volumeMoreThan', q.volume_min)
  if (q.sector) params.set('sector', q.sector)
  if (q.exchange) params.set('exchange', q.exchange)
  if (q.beta_max) params.set('betaLowerThan', q.beta_max)
  if (q.beta_min) params.set('betaMoreThan', q.beta_min)
  if (q.price_min) params.set('priceMoreThan', q.price_min)
  if (q.price_max) params.set('priceLessThan', q.price_max)
  params.set('isEtf', 'false')
  params.set('isFund', 'false')
  const limit = Math.min(Number(q.limit) || 50, 100)
  params.set('limit', String(limit))

  try {
    const resp = await fetch(`${FMP_BASE}/stock-screener?${params}`)
    if (!resp.ok) {
      return res.status(502).json({ error: `FMP API: ${resp.status}` })
    }
    const data = await resp.json()
    const list = Array.isArray(data) ? data : []
    return res.status(200).json({ results: list })
  } catch (e) {
    console.error('Screener error', e)
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Screener failed' })
  }
}
