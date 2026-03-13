import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../lib/verifyAuth'
import { supabase } from '../lib/supabase'

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

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const q = ((req.query.q as string) || '').trim()
  if (!q) {
    return res.status(400).json({ error: 'q required' })
  }

  const limitParam = (req.query.limit as string) || '10'
  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50)
  const tickerFilter = ((req.query.ticker as string) || '').trim().toUpperCase()

  try {
    const embedding = await createEmbedding(q)

    const { data, error } = await supabase.rpc('match_report_embeddings', {
      query_embedding: embedding,
      match_threshold: 0.6,
      match_count: limit,
    })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    let results = (data ?? []) as {
      id: string
      ticker: string | null
      content_type: string
      content_text: string
      similarity: number
      created_at: string
    }[]

    if (tickerFilter) {
      results = results.filter((r) => (r.ticker || '').toUpperCase() === tickerFilter)
    }

    return res.status(200).json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown embedding error'
    return res.status(500).json({ error: message })
  }
}

