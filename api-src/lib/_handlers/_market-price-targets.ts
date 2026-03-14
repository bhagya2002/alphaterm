import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'

const FMP_STABLE = 'https://financialmodelingprep.com/stable'

/** Fetch analyst price targets from FMP stable API. Returns { targets: { SYMBOL: { target, publishedDate } } } */
export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = process.env.FMP_API_KEY
  if (!key) return res.status(503).json({ error: 'FMP not configured' })

  const symbolsParam = (req.query.symbols as string) || ''
  const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20)
  if (symbols.length === 0) return res.status(400).json({ error: 'symbols required' })

  const targets: Record<string, { target: number; publishedDate?: string }> = {}
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const resp = await fetch(`${FMP_STABLE}/price-target-consensus?symbol=${encodeURIComponent(symbol)}&apikey=${key}`)
        if (!resp.ok) return
        const data = (await resp.json()) as
          | { consensus?: number; median?: number; targetConsensus?: number; targetMedian?: number }
          | Array<{ consensus?: number; median?: number; targetConsensus?: number; targetMedian?: number }>
        const first = Array.isArray(data) ? data[0] : (data as Record<string, unknown>)
        const target =
          first?.targetConsensus ??
          first?.targetMedian ??
          first?.consensus ??
          (first as { median?: number }).median
        if (target != null && Number(target) > 0) {
          targets[symbol] = { target: Number(target) }
        }
      } catch {
        // skip
      }
    })
  )
  return res.status(200).json({ targets })
}
