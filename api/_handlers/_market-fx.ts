import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../lib/verifyAuth'
import { supabase } from '../lib/supabase'

const PAIR = 'USD_CAD'
const TTL_MS = 24 * 60 * 60 * 1000 // 24h
const BOC_URL = 'https://www.bankofcanada.ca/valet/observations/FXCADUSD/json?recent=1'

/** Bank of Canada: FXCADUSD = USD per 1 CAD (e.g. 0.7344). We return CAD per 1 USD so frontend can do valueCAD = valueUSD * rate. */
async function fetchBOC(): Promise<number | null> {
  const res = await fetch(BOC_URL)
  if (!res.ok) return null
  const data = (await res.json()) as {
    observations?: { FXCADUSD?: { v?: string } }[]
  }
  const obs = data?.observations?.[0]
  const v = obs?.FXCADUSD?.v
  if (v == null) return null
  const usdPerCad = parseFloat(v)
  if (!Number.isFinite(usdPerCad) || usdPerCad <= 0) return null
  return 1 / usdPerCad // CAD per 1 USD
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pair = (req.query as { pair?: string }).pair || PAIR
  if (pair !== PAIR) {
    return res.status(400).json({ error: 'Only USD_CAD is supported' })
  }

  const { data: row } = await supabase
    .from('fx_rates')
    .select('rate, cached_at')
    .eq('pair', pair)
    .single()

  const cachedAt = row?.cached_at ? new Date(row.cached_at).getTime() : 0
  const now = Date.now()
  if (row?.rate != null && now - cachedAt < TTL_MS) {
    return res.status(200).json({ pair, rate: Number(row.rate), cached_at: row.cached_at, source: 'cache' })
  }

  const rate = await fetchBOC()
  if (rate == null) {
    if (row?.rate != null) {
      return res.status(200).json({ pair, rate: Number(row.rate), cached_at: row.cached_at, source: 'stale_cache' })
    }
    return res.status(503).json({ error: 'Could not fetch CAD/USD rate' })
  }

  await supabase.from('fx_rates').upsert({ pair, rate, cached_at: new Date().toISOString() }, { onConflict: 'pair' })
  return res.status(200).json({ pair, rate, cached_at: new Date().toISOString(), source: 'live' })
}
