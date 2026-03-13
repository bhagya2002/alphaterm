import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../../api/lib/verifyAuth'
import { supabase } from '../../api/lib/supabase'

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'
const TTL_MS = 24 * 60 * 60 * 1000 // 1 day

const DEFAULT_SERIES = [
  { id: 'FEDFUNDS', name: 'Fed Funds Rate', unit: '%' },
  { id: 'CPIAUCSL', name: 'CPI (U.S.)', unit: 'Index' },
  { id: 'DGS10', name: '10Y Treasury', unit: '%' },
]

async function fetchFREDSeries(seriesId: string, apiKey: string): Promise<{ value?: number; date?: string } | null> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    sort_order: 'desc',
    limit: '1',
  })
  const res = await fetch(`${FRED_BASE}?${params}`)
  if (!res.ok) return null
  const data = (await res.json()) as { observations?: { value?: string; date?: string }[] }
  const obs = data?.observations?.[0]
  if (!obs?.value || obs.value === '.') return null
  const value = parseFloat(obs.value)
  return Number.isFinite(value) ? { value, date: obs.date } : null
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.FRED_API_KEY
  const seriesIds = (req.query as { series?: string }).series?.split(',').filter(Boolean) ?? DEFAULT_SERIES.map((s) => s.id)

  const result: { series_id: string; name?: string; unit?: string; value?: number; observation_date?: string; cached_at?: string }[] = []
  const toFetch: string[] = []

  for (const seriesId of seriesIds) {
    const meta = DEFAULT_SERIES.find((s) => s.id === seriesId)
    const { data: row } = await supabase
      .from('macro_cache')
      .select('value, observation_date, cached_at')
      .eq('series_id', seriesId)
      .single()

    const cachedAt = row?.cached_at ? new Date(row.cached_at).getTime() : 0
    if (row?.value != null && Date.now() - cachedAt < TTL_MS) {
      result.push({
        series_id: seriesId,
        name: meta?.name,
        unit: meta?.unit,
        value: Number(row.value),
        observation_date: row.observation_date,
        cached_at: row.cached_at,
      })
      continue
    }
    toFetch.push(seriesId)
  }

  if (toFetch.length > 0 && apiKey) {
    for (const seriesId of toFetch) {
      const meta = DEFAULT_SERIES.find((s) => s.id === seriesId)
      const obs = await fetchFREDSeries(seriesId, apiKey)
      if (obs) {
        await supabase.from('macro_cache').upsert(
          {
            series_id: seriesId,
            value: obs.value,
            observation_date: obs.date ?? null,
            cached_at: new Date().toISOString(),
          },
          { onConflict: 'series_id' }
        )
        result.push({
          series_id: seriesId,
          name: meta?.name,
          unit: meta?.unit,
          value: obs.value,
          observation_date: obs.date ?? undefined,
          cached_at: new Date().toISOString(),
        })
      } else {
        result.push({ series_id: seriesId, name: meta?.name, unit: meta?.unit })
      }
    }
  } else if (toFetch.length > 0) {
    for (const seriesId of toFetch) {
      const meta = DEFAULT_SERIES.find((s) => s.id === seriesId)
      result.push({ series_id: seriesId, name: meta?.name, unit: meta?.unit })
    }
  }

  return res.status(200).json({ indicators: result })
}
