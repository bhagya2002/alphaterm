/**
 * Inference router: select LLM provider and best free-tier model per task type.
 * PRD §4: Groq (fast 8B/70B), Cerebras (70B reasoning), Google (Gemini chat), OpenRouter, Mistral.
 */

export type TaskType =
  | 'pre_market_brief'
  | 'stock_analysis_full'
  | 'news_sentiment_classify'
  | 'news_summarize'
  | 'buy_sell_recommendations'
  | 'eod_summary'
  | 'evening_digest'
  | 'overnight_brief'
  | 'chat'

export interface InferenceInput {
  taskType: TaskType
  prompt: string
  systemPrompt?: string
  contextData?: Record<string, unknown>
}

export interface InferenceResult {
  text: string
  provider: string
  model: string
  tokensApprox: number
}

/** Fast, high-quota tasks: use Groq Llama 3.1 8B (14,400/day). */
const FAST_TASKS: TaskType[] = ['pre_market_brief', 'news_sentiment_classify', 'news_summarize', 'overnight_brief']
/** Deep reasoning: use Cerebras Llama 3.3 70B (14,400/day) or OpenRouter DeepSeek-R1. */
const REASONING_TASKS: TaskType[] = ['stock_analysis_full', 'eod_summary', 'evening_digest', 'buy_sell_recommendations']

/** Provider order: NVIDIA NIMS (40 req/min) for bulk research, then Groq/Cerebras/OpenRouter/etc. */
function selectProvider(taskType: TaskType): { provider: string; model: string } {
  // Chat: best UX → Gemini, OpenRouter, Groq (avoid burning NVIDIA for chat)
  if (taskType === 'chat') {
    if (process.env.GOOGLE_AI_KEY) return { provider: 'google', model: 'gemini-2.0-flash' }
    if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }
    if (process.env.GROQ_API_KEY) return { provider: 'groq', model: 'llama-3.3-70b-versatile' }
    if (process.env.NVIDIA_NIMS_API_KEY) return { provider: 'nvidia', model: 'meta/llama3-70b' }
    if (process.env.CEREBRAS_API_KEY) return { provider: 'cerebras', model: 'llama3.1-8b' }
    if (process.env.MISTRAL_API_KEY) return { provider: 'mistral', model: 'mistral-small-latest' }
  }

  // Stock research (per-ticker): prefer NVIDIA NIMS 40 req/min for batch
  if (taskType === 'stock_analysis_full') {
    if (process.env.NVIDIA_NIMS_API_KEY) return { provider: 'nvidia', model: 'meta/llama3-70b' }
    if (process.env.GROQ_API_KEY) return { provider: 'groq', model: 'llama-3.3-70b-versatile' }
    if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', model: 'deepseek/deepseek-r1:free' }
    if (process.env.CEREBRAS_API_KEY) return { provider: 'cerebras', model: 'llama3.1-8b' }
    if (process.env.GOOGLE_AI_KEY) return { provider: 'google', model: 'gemini-2.0-flash' }
    if (process.env.MISTRAL_API_KEY) return { provider: 'mistral', model: 'mistral-small-latest' }
  }

  // Fast tasks: Groq, Cerebras, NVIDIA 8B
  if (FAST_TASKS.includes(taskType)) {
    if (process.env.GROQ_API_KEY) return { provider: 'groq', model: 'llama-3.1-8b-instant' }
    if (process.env.NVIDIA_NIMS_API_KEY) return { provider: 'nvidia', model: 'meta/llama3-8b' }
    if (process.env.CEREBRAS_API_KEY) return { provider: 'cerebras', model: 'llama3.1-8b' }
    if (process.env.MISTRAL_API_KEY) return { provider: 'mistral', model: 'mistral-small-latest' }
    if (process.env.GOOGLE_AI_KEY) return { provider: 'google', model: 'gemini-2.0-flash' }
    if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free' }
  }

  // Reasoning: Groq 70B, NVIDIA 70B, OpenRouter DeepSeek
  if (REASONING_TASKS.includes(taskType)) {
    if (process.env.GROQ_API_KEY) return { provider: 'groq', model: 'llama-3.3-70b-versatile' }
    if (process.env.NVIDIA_NIMS_API_KEY) return { provider: 'nvidia', model: 'meta/llama3-70b' }
    if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', model: 'deepseek/deepseek-r1:free' }
    if (process.env.CEREBRAS_API_KEY) return { provider: 'cerebras', model: 'llama3.1-8b' }
    if (process.env.GOOGLE_AI_KEY) return { provider: 'google', model: 'gemini-2.0-flash' }
    if (process.env.MISTRAL_API_KEY) return { provider: 'mistral', model: 'mistral-small-latest' }
  }

  if (process.env.NVIDIA_NIMS_API_KEY) return { provider: 'nvidia', model: 'meta/llama3-8b' }
  if (process.env.GROQ_API_KEY) return { provider: 'groq', model: 'llama-3.1-8b-instant' }
  if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', model: 'deepseek/deepseek-r1:free' }
  if (process.env.CEREBRAS_API_KEY) return { provider: 'cerebras', model: 'llama3.1-8b' }
  if (process.env.GOOGLE_AI_KEY) return { provider: 'google', model: 'gemini-2.0-flash' }
  if (process.env.MISTRAL_API_KEY) return { provider: 'mistral', model: 'mistral-small-latest' }
  throw new Error('No LLM provider configured. Set at least one of: GROQ_API_KEY, CEREBRAS_API_KEY, GOOGLE_AI_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, NVIDIA_NIMS_API_KEY')
}

/** Rough token count (chars/4). */
function tokensApprox(text: string): number {
  return Math.ceil((text || '').length / 4)
}

async function callGroq(messages: { role: string; content: string }[], model: string): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callCerebras(messages: { role: string; content: string }[], model: string): Promise<string> {
  const key = process.env.CEREBRAS_API_KEY
  if (!key) throw new Error('CEREBRAS_API_KEY not set')
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cerebras API error: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGoogle(prompt: string, systemPrompt?: string, model: string = 'gemini-2.0-flash'): Promise<string> {
  const key = process.env.GOOGLE_AI_KEY
  if (!key) throw new Error('GOOGLE_AI_KEY not set')
  const contents = []
  if (systemPrompt) contents.push({ role: 'user', parts: [{ text: `System: ${systemPrompt}` }] })
  contents.push({ role: 'user', parts: [{ text: prompt }] })
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google AI error: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return text
}

async function callOpenRouter(messages: { role: string; content: string }[], model: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not set')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter API error: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callNvidia(messages: { role: string; content: string }[], model: string): Promise<string> {
  const key = process.env.NVIDIA_NIMS_API_KEY
  if (!key) throw new Error('NVIDIA_NIMS_API_KEY not set')
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 2048 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NVIDIA NIMS API error: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callMistral(messages: { role: string; content: string }[], model: string): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set')
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mistral API error: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

/** Build messages array for OpenAI-style providers. */
function buildMessages(prompt: string, systemPrompt?: string): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })
  return messages
}

/** Run inference via selected provider. Returns text, provider, model, tokensApprox. */
export async function runInference(input: InferenceInput): Promise<InferenceResult> {
  const { provider, model } = selectProvider(input.taskType)
  const messages = buildMessages(input.prompt, input.systemPrompt)
  let text = ''

  if (provider === 'google') {
    text = await callGoogle(input.prompt, input.systemPrompt, model)
  } else if (provider === 'groq') {
    text = await callGroq(messages, model)
  } else if (provider === 'cerebras') {
    text = await callCerebras(messages, model)
  } else if (provider === 'openrouter') {
    text = await callOpenRouter(messages, model)
  } else if (provider === 'mistral') {
    text = await callMistral(messages, model)
  } else if (provider === 'nvidia') {
    text = await callNvidia(messages, model)
  } else {
    throw new Error(`Unknown provider: ${provider}`)
  }

  const inputTokens = tokensApprox((input.systemPrompt || '') + input.prompt)
  const outputTokens = tokensApprox(text)
  const tokensApprox = inputTokens + outputTokens

  return { text, provider, model, tokensApprox }
}
