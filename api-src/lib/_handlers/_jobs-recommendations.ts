import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../supabase'
import { verifyCron } from '../cronAuth'
import { runInference } from '../inferenceRouter'
import { getPrompt } from '../prompts'
import { todayET } from '../news'

export const config = { maxDuration: 120 }

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!verifyCron(req, res)) return

  try {
    const [
      { data: holdings },
      { data: scores },
      { data: news },
      { data: sector },
      { data: prefs },
      { data: accounts },
    ] = await Promise.all([
      supabase.from('portfolio_holdings').select('ticker, shares, avg_cost, target_sell_price, account_type, market').eq('is_active', true),
      supabase.from('stock_scores').select('ticker, score, recommendation'),
      supabase.from('news_articles').select('ticker, headline, summary, sentiment_score').order('published_at', { ascending: false }).limit(30),
      supabase.from('sector_rotation_cache').select('data, narrative').order('snapshot_date', { ascending: false }).limit(1).single(),
      supabase.from('user_preferences').select('risk_tolerance, sector_preferences').eq('id', 'default').single(),
      supabase.from('accounts').select('cash_balance, currency').eq('is_active', true),
    ])

    const cashTotal = (accounts ?? []).reduce((s: number, a: { cash_balance?: number }) => s + Number(a?.cash_balance ?? 0), 0)
    const context = JSON.stringify({
      portfolio: holdings ?? [],
      scores: scores ?? [],
      news_summaries: (news ?? []).slice(0, 15).map((n: { ticker?: string; summary?: string; headline?: string }) => ({
        ticker: n.ticker,
        summary: n.summary || n.headline,
      })),
      sector: sector?.narrative ?? 'N/A',
      cash_available: cashTotal,
      risk_tolerance: prefs?.risk_tolerance ?? 'moderate',
      sector_preferences: prefs?.sector_preferences ?? [],
    }, null, 2)

    const prompt = `${getPrompt('buy_sell_recommendations', '')}\n\nContext:\n${context}\n\nOutput a valid JSON array only.`
    const result = await runInference({ taskType: 'buy_sell_recommendations', prompt })
    const text = (result.text || '').trim()
    const match = text.match(/\[[\s\S]*\]/)
    const arr = match ? JSON.parse(match[0]) : []
    const runAt = new Date().toISOString()

    for (const r of (Array.isArray(arr) ? arr : []).slice(0, 20)) {
      const ticker = r.ticker || r.symbol
      const action = r.action || 'hold'
      if (!ticker || !['buy', 'sell', 'hold', 'add', 'reduce'].includes(String(action))) continue
      await supabase.from('ai_recommendations').insert({
        ticker: String(ticker).toUpperCase(),
        action: String(action),
        shares_suggested: r.shares_suggested != null ? Number(r.shares_suggested) : null,
        reasoning: r.reasoning ? String(r.reasoning).slice(0, 500) : null,
        run_at: runAt,
      })
    }

    await supabase.from('job_logs').insert({
      job_name: 'recommendations',
      status: 'ok',
      provider_used: result.provider,
      tokens_approx: result.tokensApprox,
      run_at: runAt,
    })
    return res.status(200).json({ ok: true, count: arr.length })
  } catch (e) {
    console.error(e)
    await supabase.from('job_logs').insert({
      job_name: 'recommendations',
      status: 'error',
      error_message: e instanceof Error ? e.message : String(e),
      run_at: new Date().toISOString(),
    })
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
