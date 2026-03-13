import { useState } from 'react'
import { apiGet } from '../lib/api'

interface SemanticResult {
  id: string
  ticker: string | null
  content_type: string
  content_text: string
  similarity: number
  created_at: string
}

export default function Settings() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SemanticResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const res = await apiGet<{ results: SemanticResult[] }>(
        `/search/semantic?q=${encodeURIComponent(q)}`
      )
      setResults(res.results ?? [])
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Semantic search requires an embedding API key.'
      setError(msg)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Settings</h1>
      <p className="text-sm text-muted">
        Job status log, API health, cache controls, and user preferences (risk level). Phase 2+.
      </p>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">
          Semantic search (reports &amp; news)
        </h2>
        <form
          onSubmit={handleSearch}
          className="border border-border rounded-lg bg-white p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search research reports and news (e.g. AAPL guidance, AI demand)"
              className="flex-1 border border-border rounded px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700 disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && !searching && results.length === 0 && query.trim() && (
            <p className="text-sm text-muted">
              No matches found yet. Make sure embeddings have been ingested.
            </p>
          )}
        </form>

        {results.length > 0 && (
          <div className="mt-3 border border-border rounded-lg bg-white p-4 space-y-3">
            {results.map((r) => (
              <div key={r.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-stone-800">
                      {r.ticker ?? 'Untagged'} · {r.content_type}
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {(r.similarity * 100).toFixed(0)}% match ·{' '}
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-700 line-clamp-3">{r.content_text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
