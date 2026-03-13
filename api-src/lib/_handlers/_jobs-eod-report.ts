import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../supabase'
import { verifyCron, isWeekdayET } from '../cronAuth'
import { runInference } from '../inferenceRouter'
import { PROMPT_TEMPLATES } from '../prompts'
import { todayET } from '../news'

export const config = { maxDuration: 60 }

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!verifyCron(req, res)) return

  let provider = ''
  let tokensApprox = 0
  try {
    if (!isWeekdayET()) {
      await supabase.from('job_logs').insert({
        job_name: 'eod_report',
        status: 'skipped',
        error_message: 'Weekend or holiday',
        run_at: new Date().toISOString(),
      })
      return res.status(200).json({ ok: true, skipped: 'not weekday' })
    }

    const reportDate = todayET()
    const { data: holdings } = await supabase
      .from('portfolio_holdings')
      .select('ticker, shares, avg_cost')
      .eq('is_active', true)
    const tickers = (holdings ?? []).map((h) => h.ticker)
    const { data: scores } = await supabase.from('stock_scores').select('ticker, score, recommendation').in('ticker', tickers)

    const scoreMap = new Map((scores ?? []).map((s) => [s.ticker, s]))
    const snapshot = (holdings ?? []).map((h) => {
      const s = scoreMap.get(h.ticker)
      return {
        ticker: h.ticker,
        shares: h.shares,
        avg_cost: h.avg_cost,
        score: s?.score,
        recommendation: s?.recommendation,
      }
    })
    const pnlSummary = { report_date: reportDate, holdings: snapshot }
    const context = JSON.stringify(pnlSummary, null, 2)

    const result = await runInference({
      taskType: 'eod_summary',
      prompt: context,
      systemPrompt: PROMPT_TEMPLATES.eod_summary,
    })

    provider = result.provider
    tokensApprox = result.tokensApprox

    await supabase.from('eod_reports').upsert(
      { report_date: reportDate, content: result.text, pnl_summary: pnlSummary },
      { onConflict: 'report_date' }
    )

    await supabase.from('job_logs').insert({
      job_name: 'eod_report',
      status: 'ok',
      provider_used: result.provider,
      tokens_approx: result.tokensApprox,
      run_at: new Date().toISOString(),
    })
    return res.status(200).json({ ok: true, report_date: reportDate })
  } catch (e) {
    console.error(e)
    await supabase.from('job_logs').insert({
      job_name: 'eod_report',
      status: 'error',
      provider_used: provider || null,
      tokens_approx: tokensApprox || null,
      error_message: e instanceof Error ? e.message : String(e),
      run_at: new Date().toISOString(),
    })
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
