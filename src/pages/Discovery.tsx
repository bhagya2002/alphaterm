import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'
import ScoreBadge from '../components/ui/ScoreBadge'

interface DiscoveryResult {
  id: string
  ticker: string
  esc_score: number
  esc_label: string | null
  ai_thesis: string | null
  signals_json: { signals?: string[]; red_flags?: string[]; confidence?: number } | null
  run_at: string
}

export default function Discovery() {
  const [results, setResults] = useState<DiscoveryResult[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const fetchResults = () => {
    setLoading(true)
    apiGet<{ results: DiscoveryResult[] }>('/discovery')
      .then((r) => setResults(r.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchResults()
  }, [])

  const runDiscovery = async () => {
    setRunning(true)
    try {
      await apiPost<{ ok: boolean }>('/discovery/run', {})
      fetchResults()
    } catch (err) {
      console.error(err)
    } finally {
      setRunning(false)
    }
  }

  const addToWatchlist = async (ticker: string) => {
    setActioning(ticker)
    try {
      await apiPost<{ entry: unknown }>('/watchlist', { ticker, company_name: ticker })
    } catch (err) {
      console.error(err)
    } finally {
      setActioning(null)
    }
  }

  const generateReport = async (ticker: string, discoveryId: string) => {
    setActioning(`${ticker}-report`)
    try {
      await apiPost<{ report: unknown }>('/reports/generate', { ticker, discovery_id: discoveryId })
    } catch (err) {
      console.error(err)
    } finally {
      setActioning(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Discovery</h1>
        <button
          type="button"
          disabled={loading || running}
          onClick={runDiscovery}
          className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700 disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run discovery'}
        </button>
      </div>
      <p className="text-sm text-muted">
        ESC-scored candidates from the screener. Run discovery to refresh; add to watchlist or generate a report per row.
      </p>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-stone-50">
                  <th className="text-left p-3 font-medium">Ticker</th>
                  <th className="text-right p-3 font-medium">ESC</th>
                  <th className="text-left p-3 font-medium">AI thesis</th>
                  <th className="text-right p-3 font-medium">Run at</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted">
                      No discovery results yet. Click &quot;Run discovery&quot; to run the screener
                      and ESC evaluation.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="p-3 whitespace-nowrap">
                        <Link
                          to={`/stock/${r.ticker}`}
                          className="font-medium text-stone-800 hover:underline"
                        >
                          {r.ticker}
                        </Link>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <ScoreBadge score={r.esc_score} size="sm" />
                        {r.esc_label && (
                          <span className="ml-1 text-muted text-xs">{r.esc_label}</span>
                        )}
                      </td>
                      <td
                        className="p-3 max-w-md truncate text-muted"
                        title={r.ai_thesis ?? ''}
                      >
                        {r.ai_thesis ?? '—'}
                      </td>
                      <td className="p-3 text-right text-muted">
                        {new Date(r.run_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            disabled={actioning === r.ticker}
                            onClick={() => addToWatchlist(r.ticker)}
                            className="text-xs font-medium text-stone-600 hover:text-stone-800 disabled:opacity-50"
                          >
                            {actioning === r.ticker ? '…' : 'Add to Watchlist'}
                          </button>
                          <button
                            type="button"
                            disabled={actioning === `${r.ticker}-report`}
                            onClick={() => generateReport(r.ticker, r.id)}
                            className="text-xs font-medium text-stone-600 hover:text-stone-800 disabled:opacity-50"
                          >
                            {actioning === `${r.ticker}-report` ? '…' : 'Generate Report'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
