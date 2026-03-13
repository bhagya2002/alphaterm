import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../lib/verifyAuth'
import { verifyCron } from '../lib/cronAuth'
import { supabase } from '../lib/supabase'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'
const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const MAX_CANDIDATES = 10
const CACHE_DAYS = 30

interface FMPScreenerRow {
  symbol: string
  companyName?: string
  marketCap?: number
  sector?: string
  beta?: number
  volume?: number
  price?: number
}

interface ESCResult {
  esc_score: number
  thesis: string
  signals: string[]
  red_flags: string[]
  confidence: number
}

function escLabel(score: number): string {
  if (score >= 7) return 'High'
  if (score >= 4) return 'Medium'
  return 'Low'
}

async function fetchFMPScreener(apikey: string): Promise<FMPScreenerRow[]> {
  const params = new URLSearchParams({
    marketCapMoreThan: '300000000',
    volumeMoreThan: '100000',
    isEtf: 'false',
    isFund: 'false',
    limit: String(MAX_CANDIDATES),
    apikey,
  })
  const res = await fetch(`${FMP_BASE}/stock-screener?${params}`)
  if (!res.ok) throw new Error(`FMP screener: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function fetchFinnhubInsider(symbol: string, token: string): Promise<{ data?: unknown[] }> {
  const to = new Date()
  const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000)
  const res = await fetch(
    `${FINNHUB_BASE}/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&token=${token}`
  )
  if (!res.ok) return {}
  const data = await res.json()
  return data
}

async function fetchFinnhubQuote(symbol: string, token: string): Promise<{ pc?: number; v?: number }> {
  const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`)
  if (!res.ok) return {}
  return res.json()
}

async function getOHLCVCache(tickers: string[]): Promise<Record<string, { close?: number; volume?: number }[]>> {
  if (tickers.length === 0) return {}
  const start = new Date()
  start.setDate(start.getDate() - CACHE_DAYS)
  const { data } = await supabase
    .from('ohlcv_cache')
    .select('ticker, close, volume, date')
    .in('ticker', tickers)
    .gte('date', start.toISOString().slice(0, 10))
    .order('date', { ascending: false })
  const byTicker: Record<string, { close?: number; volume?: number }[]> = {}
  for (const row of data ?? []) {
    const t = row.ticker as string
    if (!byTicker[t]) byTicker[t] = []
    byTicker[t].push({ close: row.close as number, volume: row.volume as number })
  }
  return byTicker
}

async function callESCLLM(
  ticker: string,
  context: string,
  openRouterKey: string
): Promise<ESCResult | null> {
  const system = `You are a stock analyst. Evaluate the given stock for "ESC" (Emerging / Sustainable / Conviction) potential. Respond with a single JSON object only, no markdown, with these exact keys: esc_score (1-10 number), thesis (short string), signals (array of strings), red_flags (array of strings), confidence (0-1 number).`
  const body = {
    model: 'deepseek/deepseek-r1',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Ticker: ${ticker}\n\nContext:\n${context}` },
    ],
    max_tokens: 512,
    temperature: 0.3,
  }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openRouterKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('OpenRouter error', res.status, text)
    return null
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) return null
  try {
    const parsed = JSON.parse(content.replace(/^```json?\s*|\s*```$/g, '')) as ESCResult
    if (typeof parsed.esc_score !== 'number') parsed.esc_score = 5
    if (typeof parsed.confidence !== 'number') parsed.confidence = 0.5
    return parsed
  } catch {
    return null
  }
}

export const config = { maxDuration: 60 }

export async function handler(req: VercelRequest, res: VercelResponse) {
  const isCron = req.method === 'GET' && verifyCron(req, res)
  const isPost = req.method === 'POST' && (await verifyAuth(req, res))
  if (!isCron && !isPost) {
    if (req.method === 'GET') return
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const fmpKey = process.env.FMP_API_KEY
  const finnhubKey = process.env.FINNHUB_API_KEY
  const openRouterKey = process.env.OPENROUTER_API_KEY

  if (!fmpKey) {
    return res.status(503).json({ error: 'FMP_API_KEY not configured' })
  }

  try {
    const candidates = await fetchFMPScreener(fmpKey)
    if (candidates.length === 0) {
      return res.status(200).json({ ok: true, message: 'No candidates from screener', count: 0 })
    }

    const tickers = candidates.map((c) => c.symbol).filter(Boolean)
    const ohlcvByTicker = await getOHLCVCache(tickers)
    const runAt = new Date().toISOString()
    const inserted: { ticker: string; esc_score: number }[] = []

    for (const row of candidates) {
      const ticker = row.symbol
      if (!ticker) continue

      let insiderSummary = 'No recent insider data.'
      let quoteSummary = 'No quote data.'
      if (finnhubKey) {
        const [insider, quote] = await Promise.all([
          fetchFinnhubInsider(ticker, finnhubKey),
          fetchFinnhubQuote(ticker, finnhubKey),
        ])
        if (insider.data?.length) {
          insiderSummary = `Recent insider transactions: ${insider.data.length} (see API data).`
        }
        if (quote.pc != null || quote.v != null) {
          quoteSummary = `Prev close: ${quote.pc ?? '—'}, Volume: ${quote.v ?? '—'}`
        }
      }

      const ohlcv = ohlcvByTicker[ticker] ?? []
      const recentPrices = ohlcv.slice(0, 5).map((r) => r.close).filter((c): c is number => c != null)
      const ohlcvSummary =
        recentPrices.length > 0
          ? `Recent closes: ${recentPrices.join(', ')}. Avg volume (cached): ${ohlcv.slice(0, 5).reduce((s, r) => s + (r.volume ?? 0), 0) / 5 | 0}`
          : 'No cached OHLCV.'

      const context = [
        `Sector: ${row.sector ?? '—'}, Market cap: ${row.marketCap ?? '—'}, Beta: ${row.beta ?? '—'}, Volume: ${row.volume ?? '—'}, Price: ${row.price ?? '—'}.`,
        quoteSummary,
        insiderSummary,
        ohlcvSummary,
      ].join('\n')

      let esc: ESCResult | null = null
      if (openRouterKey) {
        esc = await callESCLLM(ticker, context, openRouterKey)
      }
      if (!esc) {
        esc = {
          esc_score: 5,
          thesis: 'Automated discovery run; LLM evaluation skipped (no OPENROUTER_API_KEY or parse error).',
          signals: [],
          red_flags: [],
          confidence: 0.3,
        }
      }

      const { error } = await supabase.from('discovery_results').insert({
        ticker,
        esc_score: esc.esc_score,
        esc_label: escLabel(esc.esc_score),
        ai_thesis: esc.thesis,
        signals_json: { signals: esc.signals, red_flags: esc.red_flags, confidence: esc.confidence },
        run_at: runAt,
      })
      if (!error) inserted.push({ ticker, esc_score: esc.esc_score })
    }

    return res.status(200).json({
      ok: true,
      count: inserted.length,
      run_at: runAt,
      results: inserted,
    })
  } catch (e) {
    console.error('Discovery run error', e)
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Discovery run failed' })
  }
}
