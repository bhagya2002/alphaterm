import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../../api/lib/verifyAuth'
import { supabase } from '../../api/lib/supabase'

type ContentType = 'report' | 'news'

interface IngestBody {
  ticker?: string
  content_type: ContentType
  content_text: string
}

async function createEmbedding(text: string): Promise<number[]> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    throw new Error('Semantic search requires an embedding API key (OPENROUTER_API_KEY).')
  }
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large'

  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API error: ${res.status} ${err}`)
  }

  const json = (await res.json()) as {
    data?: { embedding?: number[] }[]
  }
  const embedding = json.data?.[0]?.embedding
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Embedding API returned no embedding.')
  }
  return embedding
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body: IngestBody =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body as IngestBody)

  const { ticker, content_type, content_text } = body
  if (!content_type || !content_text) {
    return res.status(400).json({ error: 'content_type and content_text are required' })
  }

  if (content_text.length < 16) {
    return res.status(400).json({ error: 'content_text too short to embed' })
  }

  try {
    const embedding = await createEmbedding(content_text)

    const { data, error } = await supabase
      .from('report_embeddings')
      .insert({
        ticker: ticker?.toUpperCase() ?? null,
        content_type,
        content_text,
        embedding,
      })
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ row: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown embedding error'
    return res.status(500).json({ error: message })
  }
}

