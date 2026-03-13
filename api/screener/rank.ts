import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../lib/verifyAuth'
import { runInference } from '../lib/inferenceRouter'

interface ScreenerRow {
  symbol?: string
  companyName?: string
  sector?: string
  marketCap?: number
  price?: number
  beta?: number
  volume?: number
  [key: string]: unknown
}

interface RankItem {
  ticker: string
  rank: number
  reasoning: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const results = body.results ?? body
  const list = Array.isArray(results) ? (results as ScreenerRow[]) : []

  if (list.length === 0) {
    return res.status(200).json({ ranked: [], reasoning: 'No stocks to rank.' })
  }

  const summary = list.slice(0, 30).map((r) => ({
    ticker: r.symbol ?? r.ticker ?? '—',
    name: r.companyName ?? r.company_name ?? '—',
    sector: r.sector ?? '—',
    marketCap: r.marketCap ?? r.market_cap,
    price: r.price,
    volume: r.volume,
  }))

  const prompt = `Rank these stocks for long-term quality and momentum (best first). Reply with a JSON array of objects: [{ "ticker": "SYMBOL", "rank": 1, "reasoning": "one sentence" }, ...]. Only output the JSON array, no other text.\n\nStocks:\n${JSON.stringify(summary, null, 2)}`

  try {
    const out = await runInference({
      taskType: 'stock_analysis_full',
      prompt,
      systemPrompt: 'You are a stock analyst. Output only valid JSON.',
    })

    let ranked: RankItem[] = []
    const raw = out.text.trim().replace(/^```json?\s*|\s*```$/g, '')
    try {
      const parsed = JSON.parse(raw)
      ranked = Array.isArray(parsed) ? parsed : []
    } catch {
      ranked = summary.map((s, i) => ({
        ticker: s.ticker,
        rank: i + 1,
        reasoning: 'Parse fallback',
      }))
    }

    return res.status(200).json({
      ranked,
      provider: out.provider,
      model: out.model,
    })
  } catch (e) {
    console.error('Screener rank error', e)
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Rank failed',
      ranked: summary.map((s, i) => ({ ticker: s.ticker, rank: i + 1, reasoning: '' })),
    })
  }
}
