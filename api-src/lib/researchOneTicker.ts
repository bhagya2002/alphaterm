/**
 * Run focused stock research for a single ticker. Used by portfolio, watchlist, and emerging research jobs.
 * Each ticker gets independent inference for focused analysis.
 */
import { supabase } from './supabase'
import { runInference } from './inferenceRouter'
import { PROMPT_TEMPLATES } from './prompts'

export type ResearchSource = 'portfolio' | 'watchlist' | 'emerging'

export async function researchOneTicker(
  ticker: string,
  source: ResearchSource
): Promise<{ ok: boolean; error?: string }> {
  const tickerUp = ticker.toUpperCase()
  const { data: scoreRow } = await supabase
    .from('stock_scores')
    .select('*')
    .eq('ticker', tickerUp)
    .maybeSingle()

  const contextData = {
    ticker: tickerUp,
    score: scoreRow?.score,
    recommendation: scoreRow?.recommendation,
    fundamental_score: scoreRow?.fundamental_score,
    technical_score: scoreRow?.technical_score,
    sentiment_score: scoreRow?.sentiment_score,
    momentum_score: scoreRow?.momentum_score,
    esc_score: scoreRow?.esc_score,
    research_context: source === 'portfolio' ? 'User holds this stock' : source === 'watchlist' ? 'User is watching this stock' : 'Up-and-coming / potential opportunity from market news, earnings, sentiment, or regulation.',
  }

  const promptContext = JSON.stringify(contextData, null, 2)
  const systemPrompt = PROMPT_TEMPLATES.stock_analysis_full

  try {
    const result = await runInference({
      taskType: 'stock_analysis_full',
      prompt: promptContext,
      systemPrompt,
    })

    const reportJson = {
      ticker: tickerUp,
      generated_at: new Date().toISOString(),
      sections: { full_text: result.text },
      provider: result.provider,
      model: result.model,
    }

    const { error } = await supabase.from('research_reports').insert({
      ticker: tickerUp,
      report_json: reportJson,
      ai_score: scoreRow?.score != null ? Number(scoreRow.score) : null,
      provider_used: result.provider,
      model_used: result.model,
      research_source: source,
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
