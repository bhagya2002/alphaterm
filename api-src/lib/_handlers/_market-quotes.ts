import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

/** REST fallback for quotes when WebSocket has no data. Returns { quotes: { SYMBOL: { price, change, changePercent, ... } } } */
export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.FINNHUB_API_KEY
  if (!token) {
    return res.status(503).json({ error: 'Finnhub not configured' })
  }

  const symbolsParam = (req.query.symbols as string) || ''
  const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
  if (symbols.length === 0) {
    return res.status(400).json({ error: 'symbols required (comma-separated)' })
  }
  if (symbols.length > 50) {
    return res.status(400).json({ error: 'max 50 symbols' })
  }

  const quotes: Record<string, { price: number; change?: number; changePercent?: number; prevClose?: number }> = {}
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const resp = await fetch(
          `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`
        )
        if (!resp.ok) return
        const data = (await resp.json()) as {
          c?: number
          d?: number
          dp?: number
          pc?: number
        }
        const price = data.c ?? data.pc
        if (price != null) {
          quotes[symbol] = {
            price: Number(price),
            change: data.d != null ? Number(data.d) : undefined,
            changePercent: data.dp != null ? Number(data.dp) : undefined,
            prevClose: data.pc != null ? Number(data.pc) : undefined,
          }
        }
      } catch {
        // skip failed symbol
      }
    })
  )
  return res.status(200).json({ quotes })
}
