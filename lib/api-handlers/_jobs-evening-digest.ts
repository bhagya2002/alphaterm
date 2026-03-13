import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../api/lib/supabase'
import { verifyCron, isWeekdayET } from '../../api/lib/cronAuth'
import { runInference } from '../../api/lib/inferenceRouter'
import { PROMPT_TEMPLATES } from '../../api/lib/prompts'
import { todayET } from '../../api/lib/news'

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
        job_name: 'evening_digest',
        status: 'skipped',
        error_message: 'Weekend or holiday',
        run_at: new Date().toISOString(),
      })
      return res.status(200).json({ ok: true, skipped: 'not weekday' })
    }

    const digestDate = todayET()
    const { data: eod } = await supabase
      .from('eod_reports')
      .select('content, pnl_summary')
      .eq('report_date', digestDate)
      .single()
    const { data: holdings } = await supabase
      .from('portfolio_holdings')
      .select('ticker, shares, avg_cost')
      .eq('is_active', true)
    const context = JSON.stringify(
      { eod: eod?.content ?? 'No EOD report yet.', pnl: eod?.pnl_summary, holdings: holdings ?? [] },
      null,
      2
    )

    const result = await runInference({
      taskType: 'evening_digest',
      prompt: context,
      systemPrompt: PROMPT_TEMPLATES.evening_digest,
    })

    provider = result.provider
    tokensApprox = result.tokensApprox

    await supabase.from('evening_digests').upsert(
      { digest_date: digestDate, content: result.text },
      { onConflict: 'digest_date' }
    )

    await supabase.from('job_logs').insert({
      job_name: 'evening_digest',
      status: 'ok',
      provider_used: result.provider,
      tokens_approx: result.tokensApprox,
      run_at: new Date().toISOString(),
    })
    return res.status(200).json({ ok: true, digest_date: digestDate })
  } catch (e) {
    console.error(e)
    await supabase.from('job_logs').insert({
      job_name: 'evening_digest',
      status: 'error',
      provider_used: provider || null,
      tokens_approx: tokensApprox || null,
      error_message: e instanceof Error ? e.message : String(e),
      run_at: new Date().toISOString(),
    })
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
