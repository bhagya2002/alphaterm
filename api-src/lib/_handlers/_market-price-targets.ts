import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'

const FMP_BASE = 'https://financialmodelingprep.com/api/v4'

/** Fetch analyst price targets from FMP. Returns { targets: { SYMBOL: { target, publishedDate } } } */
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
        const resp = await fetch(`${FMP_BASE}/price-target?symbol=${encodeURIComponent(symbol)}&apikey=${key}`)
        if (!resp.ok) return
        const data = (await resp.json()) as Array<{ symbol?: string; adjPriceTarget?: number; publishedDate?: string }>
        const item = Array.isArray(data) ? data[0] : null
        if (item?.adjPriceTarget != null) {
          targets[symbol] = {
            target: Number(item.adjPriceTarget),
            publishedDate: item.publishedDate,
          }
        }
      } catch {
        // skip
      }
    })
  )
  return res.status(200).json({ targets })
}
