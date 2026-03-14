import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'

interface ScreenerRow {
  symbol: string
  companyName?: string
  sector?: string
  marketCap?: number
  price?: number
  beta?: number
  volume?: number
}

interface PriceTarget {
  target: number
  publishedDate?: string
}

interface RankItem {
  ticker: string
  rank: number
  reasoning: string
}

const SECTORS = [
  '', 'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Industrials', 'Energy', 'Basic Materials', 'Real Estate', 'Utilities', 'Communication Services',
]

export default function Screener() {
  const [results, setResults] = useState<ScreenerRow[]>([])
  const [ranked, setRanked] = useState<RankItem[] | null>(null)
  const [priceTargets, setPriceTargets] = useState<Record<string, PriceTarget>>({})
  const [loading, setLoading] = useState(false)
  const [rankLoading, setRankLoading] = useState(false)
  const [filters, setFilters] = useState({
    market_cap_min: '',
    volume_min: '',
    sector: '',
    limit: '30',
  })

  const runScreener = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setRanked(null)
    try {
      const params = new URLSearchParams()
      if (filters.market_cap_min) params.set('market_cap_min', filters.market_cap_min)
      if (filters.volume_min) params.set('volume_min', filters.volume_min)
      if (filters.sector) params.set('sector', filters.sector)
      if (filters.limit) params.set('limit', filters.limit)
      const res = await apiGet<{ results: ScreenerRow[] }>(`/screener?${params}`)
      setResults(res.results ?? [])
    } catch (err) {
      console.error(err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const symbols = (ranked && ranked.length > 0
      ? ranked.map((r) => r.ticker)
      : results.map((r) => r.symbol)
    ).filter(Boolean).slice(0, 20)
    if (symbols.length === 0) return
    apiGet<{ targets: Record<string, PriceTarget> }>(`/market/price-targets?symbols=${encodeURIComponent(symbols.join(','))}`)
      .then((r) => setPriceTargets(r.targets ?? {}))
      .catch(() => {})
  }, [results, ranked])

  const rankWithAI = async () => {
    if (results.length === 0) return
    setRankLoading(true)
    try {
      const res = await apiPost<{ ranked: RankItem[] }>('/screener/rank', { results })
      setRanked(res.ranked ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setRankLoading(false)
    }
  }

  const displayList: (ScreenerRow & { rank?: number; reasoning?: string })[] =
    ranked && ranked.length > 0
      ? ranked.map((r) => {
          const row = results.find((x) => (x.symbol || '').toUpperCase() === r.ticker.toUpperCase())
          return {
            symbol: row?.symbol ?? r.ticker,
            companyName: row?.companyName,
            sector: row?.sector,
            marketCap: row?.marketCap,
            price: row?.price,
            beta: row?.beta,
            volume: row?.volume,
            rank: r.rank,
            reasoning: r.reasoning,
          }
        })
      : results.map((r, i) => ({ ...r, rank: i + 1, reasoning: '' as string }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Screener</h1>
      <p className="text-sm text-muted">
        Filter stocks with FMP screener. Optionally rank results with AI.
      </p>

      <form onSubmit={runScreener} className="border border-border rounded-lg bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Market cap min</label>
            <input
              type="text"
              value={filters.market_cap_min}
              onChange={(e) => setFilters((f) => ({ ...f, market_cap_min: e.target.value }))}
              placeholder="e.g. 1000000000"
              className="w-full border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Volume min</label>
            <input
              type="text"
              value={filters.volume_min}
              onChange={(e) => setFilters((f) => ({ ...f, volume_min: e.target.value }))}
              placeholder="e.g. 1000000"
              className="w-full border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Sector</label>
            <select
              value={filters.sector}
              onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
              className="w-full border border-border rounded px-3 py-2 text-sm"
            >
              {SECTORS.map((s) => (
                <option key={s || '_'} value={s}>{s || 'Any'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Limit</label>
            <input
              type="number"
              min={1}
              max={100}
              value={filters.limit}
              onChange={(e) => setFilters((f) => ({ ...f, limit: e.target.value }))}
              className="w-full border border-border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? 'Running…' : 'Run screener'}
          </button>
          <button
            type="button"
            disabled={loading || results.length === 0 || rankLoading}
            onClick={rankWithAI}
            className="text-sm font-medium border border-border text-stone-700 px-4 py-2 rounded-md hover:bg-stone-50 disabled:opacity-50"
          >
            {rankLoading ? 'Ranking…' : 'Rank with AI'}
          </button>
        </div>
      </form>

      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-stone-50">
                {ranked && ranked.length > 0 && (
                  <th className="text-left p-3 font-medium">Rank</th>
                )}
                <th className="text-left p-3 font-medium">Ticker</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Sector</th>
                <th className="text-right p-3 font-medium">Market cap</th>
                <th className="text-right p-3 font-medium">Price</th>
                <th className="text-right p-3 font-medium">Volume</th>
                <th className="text-right p-3 font-medium">Upside %</th>
                {ranked && ranked.length > 0 && (
                  <th className="text-left p-3 font-medium">Reasoning</th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 && !loading && (
                <tr>
                  <td colSpan={ranked?.length ? 9 : 8} className="p-4 text-center text-muted">
                    No results. Set filters and click &quot;Run screener&quot;.
                  </td>
                </tr>
              )}
              {displayList.map((row, i) => (
                <tr key={row.symbol + i} className="border-b border-border last:border-0">
                  {'rank' in row && row.rank != null && (
                    <td className="p-3 font-medium whitespace-nowrap">{row.rank}</td>
                  )}
                  <td className="p-3 whitespace-nowrap">
                    <Link
                      to={`/stock/${row.symbol}`}
                      className="font-medium text-stone-800 hover:underline"
                    >
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="p-3 text-muted truncate max-w-[160px]">
                    {row.companyName ?? '—'}
                  </td>
                  <td className="p-3 text-muted">{row.sector ?? '—'}</td>
                  <td className="p-3 text-right">
                    {row.marketCap != null ? (row.marketCap / 1e9).toFixed(2) + 'B' : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {row.price != null ? row.price.toFixed(2) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {row.volume != null ? (row.volume / 1e6).toFixed(2) + 'M' : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {(() => {
                      const sym = (row.symbol || '').toUpperCase()
                      const pt = priceTargets[sym]
                      const price = row.price
                      if (!pt || !price || pt.target <= 0) return '—'
                      const upside = ((pt.target - price) / price) * 100
                      return (
                        <span className={upside > 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {upside > 0 ? '+' : ''}{upside.toFixed(1)}%
                        </span>
                      )
                    })()}
                  </td>
                  {'reasoning' in row && row.reasoning && (
                    <td
                      className="p-3 text-muted max-w-[260px] truncate"
                      title={row.reasoning}
                    >
                      {row.reasoning}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
