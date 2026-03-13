import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../api/lib/supabase'
import { verifyCron, isWeekdayET } from '../api/lib/cronAuth'
import { runInference } from '../api/lib/inferenceRouter'
import { PROMPT_TEMPLATES } from '../api/lib/prompts'
import { fetchFinnhubMarketNews } from '../api/lib/news'

export const config = { maxDuration: 60 }

/** Tomorrow's date in YYYY-MM-DD (ET) for overnight brief. */
function tomorrowET(): string {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  et.setDate(et.getDate() + 1)
  return et.toISOString().slice(0, 10)
}

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
        job_name: 'overnight_brief',
        status: 'skipped',
        error_message: 'Weekend or holiday',
        run_at: new Date().toISOString(),
      })
      return res.status(200).json({ ok: true, skipped: 'not weekday' })
    }

    const [marketNews] = await Promise.all([fetchFinnhubMarketNews('general')])
    const headlines = (marketNews ?? []).slice(0, 25).map((n) => n.headline).filter(Boolean)
    const newsBlock = headlines.length ? headlines.join('\n') : 'No overnight headlines available.'

    const result = await runInference({
      taskType: 'overnight_brief',
      prompt: newsBlock,
      systemPrompt: PROMPT_TEMPLATES.overnight_brief,
    })

    provider = result.provider
    tokensApprox = result.tokensApprox
    const briefDate = tomorrowET()

    await supabase.from('overnight_briefs').upsert(
      { brief_date: briefDate, content: result.text },
      { onConflict: 'brief_date' }
    )

    await supabase.from('job_logs').insert({
      job_name: 'overnight_brief',
      status: 'ok',
      provider_used: result.provider,
      tokens_approx: result.tokensApprox,
      run_at: new Date().toISOString(),
    })
    return res.status(200).json({ ok: true, brief_date: briefDate })
  } catch (e) {
    console.error(e)
    await supabase.from('job_logs').insert({
      job_name: 'overnight_brief',
      status: 'error',
      provider_used: provider || null,
      tokens_approx: tokensApprox || null,
      error_message: e instanceof Error ? e.message : String(e),
      run_at: new Date().toISOString(),
    })
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
