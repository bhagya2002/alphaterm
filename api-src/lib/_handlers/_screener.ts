import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'

const FMP_STABLE = 'https://financialmodelingprep.com/stable'
const EODHD_BASE = 'https://eodhd.com/api'

interface ScreenerRow {
  symbol: string
  companyName?: string
  sector?: string
  marketCap?: number
  price?: number
  beta?: number
  volume?: number
}

function mapEodhdToRow(r: Record<string, unknown>): ScreenerRow {
  return {
    symbol: String(r.code ?? r.symbol ?? ''),
    companyName: r.name as string | undefined,
    sector: r.sector as string | undefined,
    marketCap: typeof r.market_capitalization === 'number' ? r.market_capitalization : Number(r.market_capitalization) || undefined,
    price: typeof r.adjusted_close === 'number' ? r.adjusted_close : Number(r.adjusted_close) || undefined,
    volume: typeof r.avgvol_1d === 'number' ? r.avgvol_1d : Number(r.avgvol_1d) || undefined,
  }
}

async function fetchEodhdScreener(token: string, q: Record<string, string | undefined>): Promise<ScreenerRow[]> {
  const filters: [string, string, number | string][] = []
  if (q.market_cap_min) filters.push(['market_capitalization', '>', Number(q.market_cap_min) || 300000000])
  if (q.market_cap_max) filters.push(['market_capitalization', '<', Number(q.market_cap_max) || 999999999999999])
  if (q.volume_min) filters.push(['avgvol_1d', '>', Number(q.volume_min) || 100000])
  if (q.sector) filters.push(['sector', '=', q.sector])
  const limit = Math.min(Number(q.limit) || 50, 100)
  const params = new URLSearchParams({
    api_token: token,
    limit: String(limit),
    sort: 'market_capitalization.desc',
  })
  if (filters.length > 0) params.set('filters', JSON.stringify(filters))
  const resp = await fetch(`${EODHD_BASE}/screener?${params}`)
  if (!resp.ok) return []
  const data = await resp.json()
  const arr = Array.isArray(data) ? data : (data?.data ?? data?.results ?? [])
  return arr.map((r: Record<string, unknown>) => mapEodhdToRow(r)).filter((r: ScreenerRow) => !!r.symbol)
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const fmpKey = process.env.FMP_API_KEY
  const eodhdToken = process.env.EODHD_API_TOKEN
  if (!fmpKey && !eodhdToken) {
    return res.status(503).json({ error: 'FMP_API_KEY or EODHD_API_TOKEN required for screener' })
  }

  const q = req.query as Record<string, string | undefined>
  const limit = Math.min(Number(q.limit) || 50, 100)

  try {
    // Try FMP first (if configured)
    if (fmpKey) {
      const params = new URLSearchParams({ apikey: fmpKey, limit: String(limit) })
      if (q.market_cap_min) params.set('marketCapMoreThan', q.market_cap_min)
      if (q.market_cap_max) params.set('marketCapLessThan', q.market_cap_max)
      if (q.volume_min) params.set('volumeMoreThan', q.volume_min)
      if (q.sector) params.set('sector', q.sector)
      if (q.exchange) params.set('exchange', q.exchange)
      if (q.beta_max) params.set('betaLowerThan', q.beta_max)
      if (q.beta_min) params.set('betaMoreThan', q.beta_min)
      if (q.price_min) params.set('priceMoreThan', q.price_min)
      if (q.price_max) params.set('priceLessThan', q.price_max)

      const resp = await fetch(`${FMP_STABLE}/company-screener?${params}`)
      const data = await resp.json()
      if (resp.ok && Array.isArray(data)) {
        return res.status(200).json({ results: data })
      }
    }

    // Fallback to EODHD
    if (eodhdToken) {
      const list = await fetchEodhdScreener(eodhdToken, q)
      return res.status(200).json({ results: list })
    }

    return res.status(502).json({ error: 'Screener provider unavailable (FMP restricted; add EODHD_API_TOKEN for fallback)' })
  } catch (e) {
    console.error('Screener error', e)
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Screener failed' })
  }
}
