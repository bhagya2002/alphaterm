import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../api/lib/verifyAuth'
import { supabase } from '../api/lib/supabase'
import { runInference } from '../api/lib/inferenceRouter'
import { PROMPT_TEMPLATES } from '../api/lib/prompts'

export const config = { maxDuration: 60 }

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const ticker = body.ticker ? String(body.ticker).toUpperCase() : null
  const style = (body.style as string) || 'full' // full | deep_dive | quant | cio
  if (!ticker) {
    return res.status(400).json({ error: 'ticker required' })
  }

  const { data: scoreRow } = await supabase.from('stock_scores').select('*').eq('ticker', ticker).maybeSingle()
  const contextData = {
    ticker,
    score: scoreRow?.score,
    recommendation: scoreRow?.recommendation,
    fundamental_score: scoreRow?.fundamental_score,
    technical_score: scoreRow?.technical_score,
    sentiment_score: scoreRow?.sentiment_score,
    momentum_score: scoreRow?.momentum_score,
    esc_score: scoreRow?.esc_score,
  }
  let systemPrompt: string
  let promptContext: string
  if (style === 'deep_dive') {
    systemPrompt = PROMPT_TEMPLATES.deep_dive_analyst.replace('[TICKER]', ticker)
    promptContext = JSON.stringify(contextData, null, 2)
  } else if (style === 'quant') {
    systemPrompt = PROMPT_TEMPLATES.quant_technical.replace('[TICKER]', ticker)
    promptContext = JSON.stringify(contextData, null, 2)
  } else if (style === 'cio') {
    const { data: holdings } = await supabase.from('portfolio_holdings').select('ticker, shares, avg_cost, account_type').eq('is_active', true)
    const list = (holdings ?? []).map((h) => `${h.ticker} ${h.shares} @ ${h.avg_cost} (${h.account_type})`).join(', ')
    systemPrompt = PROMPT_TEMPLATES.chief_investment_officer.replace('[LIST HOLDINGS & %]', list).replace('[X]%', '5')
    promptContext = JSON.stringify(contextData, null, 2)
  } else {
    systemPrompt = PROMPT_TEMPLATES.stock_analysis_full
    promptContext = JSON.stringify(contextData, null, 2)
  }

  try {
    const result = await runInference({
      taskType: 'stock_analysis_full',
      prompt: promptContext,
      systemPrompt,
    })

    const reportJson = {
      ticker,
      generated_at: new Date().toISOString(),
      sections: { full_text: result.text },
      provider: result.provider,
      model: result.model,
    }
    const aiScore = scoreRow?.score != null ? Number(scoreRow.score) : null

    const { data: report, error } = await supabase
      .from('research_reports')
      .insert({
        ticker,
        report_json: reportJson,
        ai_score: aiScore ?? undefined,
        provider_used: result.provider,
        model_used: result.model,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ report })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
