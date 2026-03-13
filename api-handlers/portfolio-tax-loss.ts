import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'
import { supabase } from '../api/lib/supabase'

interface HoldingRow {
  id: string
  ticker: string
  account_type: string
  shares: number
  avg_cost: number
}

interface TaxLossItem {
  holding_id: string
  ticker: string
  account_type: string
  shares: number
  avg_cost: number
  current_price: number | null
  current_value: number | null
  cost_basis: number
  unrealized_gain_loss: number | null
  tax_loss_candidate: boolean
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { data, error } = await supabase
    .from<HoldingRow>('portfolio_holdings')
    .select('id, ticker, account_type, shares, avg_cost')
    .eq('is_active', true)
    .eq('account_type', 'Personal')

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return res.status(200).json({ holdings: [] as TaxLossItem[] })
  }

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    const stub = rows.map<TaxLossItem>((h) => {
      const costBasis = Number(h.avg_cost) * Number(h.shares)
      return {
        holding_id: h.id,
        ticker: h.ticker,
        account_type: h.account_type,
        shares: Number(h.shares),
        avg_cost: Number(h.avg_cost),
        current_price: null,
        current_value: null,
        cost_basis: costBasis,
        unrealized_gain_loss: null,
        tax_loss_candidate: false,
      }
    })
    return res.status(200).json({
      holdings: stub,
      source: 'stub',
      message: 'Tax-loss flag requires FINNHUB_API_KEY for live prices.',
    })
  }

  const uniqueTickers = Array.from(new Set(rows.map((h) => h.ticker)))
  const priceMap = new Map<string, number>()

  await Promise.all(
    uniqueTickers.map(async (ticker) => {
      try {
        const resp = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
            ticker
          )}&token=${encodeURIComponent(apiKey)}`
        )
        if (!resp.ok) return
        const json = (await resp.json()) as { c?: number }
        if (typeof json.c === 'number' && Number.isFinite(json.c)) {
          priceMap.set(ticker, json.c)
        }
      } catch {
        // ignore individual quote errors
      }
    })
  )

  const holdings: TaxLossItem[] = rows.map((h) => {
    const currentPrice = priceMap.get(h.ticker) ?? null
    const costBasis = Number(h.avg_cost) * Number(h.shares)
    const currentValue = currentPrice != null ? currentPrice * Number(h.shares) : null
    const unrealized =
      currentValue != null && Number.isFinite(costBasis) ? currentValue - costBasis : null
    const taxLossCandidate = unrealized != null && unrealized < 0

    return {
      holding_id: h.id,
      ticker: h.ticker,
      account_type: h.account_type,
      shares: Number(h.shares),
      avg_cost: Number(h.avg_cost),
      current_price: currentPrice,
      current_value: currentValue,
      cost_basis: costBasis,
      unrealized_gain_loss: unrealized,
      tax_loss_candidate: taxLossCandidate,
    }
  })

  return res.status(200).json({ holdings, source: 'finnhub' })
}

