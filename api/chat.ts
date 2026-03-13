import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from './lib/verifyAuth'
import { supabase } from './lib/supabase'
import { runInference } from './lib/inferenceRouter'
import { PROMPT_TEMPLATES } from './lib/prompts'
import { todayET } from './lib/news'

export const config = { maxDuration: 60 }

function getSessionId(req: VercelRequest): string {
  const cookie = req.headers.cookie
  const match = cookie?.match(/(?:^|;\s*)alphaterm_session=([^;]*)/)
  return match ? match[1].slice(0, 32) : 'default'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  const [{ data: holdings }, { data: scores }, { data: news }] = await Promise.all([
    supabase.from('portfolio_holdings').select('ticker, shares, avg_cost').eq('is_active', true),
    supabase.from('stock_scores').select('ticker, score, recommendation'),
    supabase.from('news_articles').select('ticker, headline, sentiment_score').gte('published_at', today).limit(20),
  ])

  const contextSnapshot = {
    portfolio: holdings ?? [],
    scores: scores ?? [],
    headlines: (news ?? []).map((n) => ({ ticker: n.ticker, headline: n.headline, sentiment: n.sentiment_score })),
    date: today,
  }
  const contextBlock = JSON.stringify(contextSnapshot, null, 2)
  const systemPrompt = `${PROMPT_TEMPLATES.chat_system_prompt}\n\nContext (portfolio, scores, today's headlines):\n${contextBlock}`

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
