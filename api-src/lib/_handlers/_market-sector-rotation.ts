import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'
import { runInference } from '../inferenceRouter'

interface SectorPerf {
  sector?: string
  changesPercentage?: string
  avgChangePercent?: number
  performance?: number
}

const TTL_MS = 60 * 60 * 1000 // 1 hour

function stubResponse(res: VercelResponse) {
  return res.status(200).json({
    sectors: [],
    narrative: null,
    source: 'stub',
  })
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const now = new Date()
  const { data: cachedRows, error: cacheErr } = await supabase
    .from('sector_rotation_cache')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
  if (cacheErr) {
    console.error('[sector-rotation] cache read failed:', cacheErr.message)
    return stubResponse(res)
  }
  const cached = (cachedRows ?? [])[0] as
    | { id: string; snapshot_date: string; data: any; narrative?: string | null; created_at: string }
    | undefined

  if (cached) {
    const createdAt = new Date(cached.created_at).getTime()
    if (now.getTime() - createdAt < TTL_MS) {
      return res.status(200).json({
        sectors: cached.data?.sectors ?? [],
        narrative: cached.narrative ?? null,
        source: 'cache',
      })
    }
  }

  const alphaKey = process.env.ALPHA_VANTAGE_KEY
  const fmpKey = process.env.FMP_API_KEY
  if (!alphaKey && !fmpKey) {
    return stubResponse(res)
  }

  try {
    // Prefer Alpha Vantage SECTOR (free); FMP stable requires premium for date param
    let sectors: { sector: string; performance_1d: number }[] = []

    if (alphaKey) {
      const avResp = await fetch(
        `https://www.alphavantage.co/query?function=SECTOR&apikey=${encodeURIComponent(alphaKey)}`
      )
      if (avResp.ok) {
        const av = (await avResp.json()) as Record<string, unknown>
        // Alpha Vantage returns "Rank B: 1 Day" or "Real Time Performance" with sector->percent
        const dayData =
          (av['Rank B: 1 Day'] as Record<string, string>) ??
          (av['Rank A: Real-Time Performance'] as Record<string, string>) ??
          (av['Real Time Performance'] as Record<string, string>)
        if (dayData && typeof dayData === 'object') {
          sectors = Object.entries(dayData)
            .map(([sector, pctStr]) => {
              const pct = parseFloat(String(pctStr || '0').replace('%', '').replace('+', '')) || 0
              return { sector, performance_1d: pct }
            })
            .filter((s) => !!s.sector)
        }
      }
    }

    if (sectors.length === 0 && fmpKey) {
      const date = now.toISOString().slice(0, 10)
      const resp = await fetch(
        `https://financialmodelingprep.com/stable/sector-performance-snapshot?date=${date}&apikey=${encodeURIComponent(fmpKey)}`
      )
      if (resp.ok) {
        const json = (await resp.json()) as
          | { sectorPerformance?: SectorPerf[]; data?: SectorPerf[] }
          | SectorPerf[]
        const list: SectorPerf[] = Array.isArray(json)
          ? json
          : (json as { sectorPerformance?: SectorPerf[]; data?: SectorPerf[] }).sectorPerformance ||
            (json as { sectorPerformance?: SectorPerf[]; data?: SectorPerf[] }).data ||
            []
        sectors = list
          .map((s) => {
            let pct = 0
            if (s.avgChangePercent != null) pct = Number(s.avgChangePercent)
            else if (s.performance != null) pct = Number(s.performance)
            else if (s.changesPercentage) {
              const pctStr = String(s.changesPercentage).replace('%', '').replace('+', '')
              pct = parseFloat(pctStr) || 0
            }
            return {
              sector: s.sector ?? 'Unknown',
              performance_1d: Number.isFinite(pct) ? pct : 0,
            }
          })
          .filter((s) => !!s.sector && s.sector !== 'Unknown')
      }
    }

    sectors.sort((a, b) => b.performance_1d - a.performance_1d)

    let narrative: string | null = null
    try {
      const lines = sectors
        .map((s) => `${s.sector}: ${s.performance_1d.toFixed(2)}%`)
        .join('\n')
      const { text } = await runInference({
        taskType: 'stock_analysis_full',
        prompt: `Here is 1-day sector performance data (percentage change):\n\n${lines}\n\nDescribe the apparent sector rotation in one sentence for a retail investor.`,
        systemPrompt:
          'You are a concise market strategist. Summarise sector rotation clearly in one sentence.',
        contextData: { source: 'fmp-sector-performance' },
      })
      narrative = text.trim()
    } catch {
      narrative = null
    }

    const payload = {
      sectors,
      narrative,
    }

    try {
      const { error } = await supabase.from('sector_rotation_cache').insert({
        snapshot_date: now.toISOString().slice(0, 10),
        horizon: '1D',
        data: payload,
        narrative,
      })
      if (error) console.error('[sector-rotation] cache insert error:', error.message)
    } catch (e) {
      console.error('[sector-rotation] cache insert failed:', e)
    }

    return res.status(200).json({ ...payload, source: 'live' })
  } catch (e) {
    console.error('[sector-rotation] error:', e)
    return stubResponse(res)
  }
}

