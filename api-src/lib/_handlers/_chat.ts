import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../verifyAuth'
import { supabase } from '../supabase'
import { runInference } from '../inferenceRouter'
import { PROMPT_TEMPLATES } from '../prompts'
import { todayET } from '../news'

export const config = { maxDuration: 60 }

function getSessionId(req: VercelRequest): string {
  const cookie = req.headers.cookie
  const match = cookie?.match(/(?:^|;\s*)alphaterm_session=([^;]*)/)
  return match ? match[1].slice(0, 32) : 'default'
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method === 'GET') {
    const sessionId = (req.query.session_id as string) || getSessionId(req)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, timestamp')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ messages: data ?? [] })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const message = body.message ? String(body.message).trim() : null
  if (!message) {
    return res.status(400).json({ error: 'message required' })
  }

  const sessionId = body.session_id || getSessionId(req)

  const today = todayET()
  const [
    { data: holdings },
    { data: scores },
    { data: news },
    { data: prefs },
  ] = await Promise.all([
    supabase.from('portfolio_holdings').select('ticker, shares, avg_cost, account_type').eq('is_active', true),
    supabase.from('stock_scores').select('ticker, score, recommendation'),
    supabase.from('news_articles').select('ticker, headline, summary, sentiment_score').gte('published_at', today).limit(20),
    supabase.from('user_preferences').select('risk_tolerance').eq('id', 'default').single(),
  ])

  const contextSnapshot = {
    portfolio: holdings ?? [],
    scores: scores ?? [],
    headlines: (news ?? []).map((n) => ({
      ticker: n.ticker,
      headline: n.headline,
      summary: n.summary,
      sentiment: n.sentiment_score,
    })),
    risk_tolerance: prefs?.risk_tolerance ?? 'moderate',
    date: today,
  }
  const contextBlock = JSON.stringify(contextSnapshot, null, 2)
  const prefsNote = prefs?.risk_tolerance ? ` User risk preference: ${prefs.risk_tolerance}.` : ''
  const systemPrompt = `${PROMPT_TEMPLATES.chat_system_prompt}${prefsNote}\n\nContext (portfolio, scores, news summaries, risk):\n${contextBlock}`

  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
    context_snapshot: contextSnapshot,
  })

  let reply: string
  let provider = ''
  try {
    const result = await runInference({
      taskType: 'chat',
      prompt: message,
      systemPrompt,
    })
    reply = result.text
    provider = result.provider
  } catch (e) {
    console.error(e)
    reply = 'Sorry, I could not generate a response right now. Please try again.'
  }

  const { data: assistantRow, error: insertError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role: 'assistant',
      content: reply,
      provider_used: provider,
    })
    .select('id, content, timestamp')
    .single()

  if (insertError) return res.status(500).json({ error: insertError.message })
  return res.status(200).json({ reply: assistantRow?.content ?? reply, message_id: assistantRow?.id })
}
