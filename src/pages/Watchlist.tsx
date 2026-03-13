import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMarketStore } from '../store/marketStore'
import { apiGet, apiPost, apiDelete } from '../lib/api'

interface WatchlistEntry {
  id: string
  ticker: string
  company_name: string
  exchange: string
  market: string
  added_at: string
  notes: string
  alert_enabled: boolean
}

export default function Watchlist() {
  const quotes = useMarketStore((s) => s.quotes)
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newTicker, setNewTicker] = useState('')

  useEffect(() => {
    apiGet<{ watchlist: WatchlistEntry[] }>('/watchlist')
      .then((r) => r.watchlist && setEntries(r.watchlist))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const addTicker = async (e: React.FormEvent) => {
    e.preventDefault()
    const ticker = newTicker.trim().toUpperCase()
    if (!ticker) return
    try {
      const res = await apiPost<{ entry: WatchlistEntry }>('/watchlist', { ticker, company_name: ticker })
      if (res.entry) setEntries((prev) => [...prev, res.entry])
      setNewTicker('')
    } catch (err) {
      console.error(err)
    }
  }

  const removeTicker = async (id: string) => {
    try {
      await apiDelete(`/watchlist/${id}`)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="text-muted">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Watchlist</h1>

      <form onSubmit={addTicker} className="flex gap-2">
        <input
          type="text"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
          placeholder="Add ticker (e.g. AAPL)"
          className="border border-border rounded px-3 py-2 text-sm w-40"
        />
        <button type="submit" className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700">
          Add
        </button>
      </form>

      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-stone-50">
                <th className="text-left p-3 font-medium">Ticker</th>
                <th className="text-right p-3 font-medium">Price</th>
                <th className="text-right p-3 font-medium">Change</th>
                <th className="text-left p-3 font-medium">Added</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const q = quotes[e.ticker]
                return (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="p-3 whitespace-nowrap">
                      <Link
                        to={`/stock/${e.ticker}`}
                        className="font-medium text-stone-800 hover:underline"
                      >
                        {e.ticker}
                      </Link>
                    </td>
                    <td className="p-3 text-right">{q ? q.price.toFixed(2) : '—'}</td>
                    <td className="p-3 text-right">
                      {q?.changePercent != null ? (
                        <span
                          className={
                            q.changePercent >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }
                        >
                          {q.changePercent >= 0 ? '↑' : '↓'}{' '}
                          {Math.abs(q.changePercent).toFixed(2)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-muted">
                      {new Date(e.added_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => removeTicker(e.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {entries.length === 0 && (
          <p className="p-4 text-center text-muted text-sm">
            No watchlist entries. Add a ticker above.
          </p>
        )}
      </div>
    </div>
  )
}
