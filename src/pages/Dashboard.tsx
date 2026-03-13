import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolioStore } from '../store/portfolioStore'
import { useMarketStore } from '../store/marketStore'
import { useAlertStore } from '../store/alertStore'
import { useCurrencyStore, formatDisplayCurrency } from '../store/currencyStore'
import ScoreBadge from '../components/ui/ScoreBadge'
import AlertCard from '../components/ui/AlertCard'
import MacroPanel from '../components/ui/MacroPanel'
import { apiGet, apiPatch } from '../lib/api'

interface StockScore {
  ticker: string
  score?: number
  recommendation?: string
}

interface SectorRotationItem {
  sector: string
  performance_1d: number
}

export default function Dashboard() {
  const holdings = usePortfolioStore((s) => s.holdings)
  const quotes = useMarketStore((s) => s.quotes)
  const alerts = useAlertStore((s) => s.alerts)
  const setHoldings = usePortfolioStore((s) => s.setHoldings)
  const setAlerts = useAlertStore((s) => s.setAlerts)
  const dismissAlert = useAlertStore((s) => s.dismissAlert)
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency)
  const usdToCadRate = useCurrencyStore((s) => s.usdToCadRate)
  const [scores, setScores] = useState<Record<string, StockScore>>({})
  const [news, setNews] = useState<{ ticker: string; headline: string; source: string; url: string; sentiment_score: number | null }[]>([])
  const [sectors, setSectors] = useState<SectorRotationItem[]>([])
  const [sectorNarrative, setSectorNarrative] = useState<string | null>(null)
  const activeHoldings = useMemo(() => holdings.filter((h) => h.is_active), [holdings])
  const scoreTickers = useMemo(() => activeHoldings.map((h) => h.ticker).join(','), [activeHoldings])

  useEffect(() => {
    apiGet<{ holdings: typeof holdings }>('/portfolio').then((r) => r.holdings && setHoldings(r.holdings)).catch(() => {})
    apiGet<{ alerts: typeof alerts }>('/alerts').then((r) => r.alerts && setAlerts(r.alerts)).catch(() => {})
  }, [setHoldings, setAlerts])

  useEffect(() => {
    if (activeHoldings.length === 0) return
    apiGet<{ scores: StockScore[] }>(`/scores?tickers=${encodeURIComponent(scoreTickers)}`)
      .then((r) => {
        const map: Record<string, StockScore> = {}
        ;(r.scores ?? []).forEach((s) => { map[s.ticker] = s })
        setScores(map)
      })
      .catch(() => {})
  }, [scoreTickers, activeHoldings.length])

  useEffect(() => {
    if (activeHoldings.length === 0) return
    apiGet<{ articles: Array<{ ticker: string; headline: string; source: string; url: string; sentiment_score: number | null }> }>(
      `/news?tickers=${encodeURIComponent(scoreTickers)}`
    )
      .then((r) => setNews(r.articles ?? []))
      .catch(() => {})
  }, [scoreTickers, activeHoldings.length])

  useEffect(() => {
    apiGet<{ sectors: SectorRotationItem[]; narrative?: string | null }>(
      '/market/sector-rotation'
    )
      .then((r) => {
        setSectors(r.sectors ?? [])
        setSectorNarrative(r.narrative ?? null)
      })
      .catch(() => {
        setSectors([])
        setSectorNarrative(null)
      })
  }, [])
  const totalValue = useMemo(() => {
    return activeHoldings.reduce((sum, h) => {
      const q = quotes[h.ticker]
      if (!q) return sum
      return sum + q.price * h.shares
    }, 0)
  }, [activeHoldings, quotes])
  const handleDismissAlert = (id: string) => {
    apiPatch(`/alerts/${id}`, { dismissed: true }).then(() => dismissAlert(id)).catch(() => {})
  }
  const totalCost = useMemo(
    () => activeHoldings.reduce((sum, h) => sum + h.avg_cost * h.shares, 0),
    [activeHoldings]
  )
  const pnl = totalValue - totalCost
  const pnlPct = totalCost ? (pnl / totalCost) * 100 : 0

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Dashboard</h1>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Portfolio summary</h2>
        <div className="border border-border rounded-lg bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted">Total value</p>
              <p className="font-medium">{formatDisplayCurrency(totalValue, displayCurrency, usdToCadRate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Cost basis</p>
              <p className="font-medium">{formatDisplayCurrency(totalCost, displayCurrency, usdToCadRate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">P&L</p>
              <p className={`font-medium ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {pnl >= 0 ? '↑' : '↓'} {formatDisplayCurrency(Math.abs(pnl), displayCurrency, usdToCadRate)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Macro</h2>
        <MacroPanel />
      </section>

      {sectors.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted mb-2">Sector rotation</h2>
          <div className="border border-border rounded-lg bg-white p-4 space-y-3">
            {sectorNarrative && (
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{sectorNarrative}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted mb-1">Leaders</p>
                <ul className="space-y-1">
                  {sectors.slice(0, 3).map((s) => (
                    <li key={s.sector} className="flex justify-between">
                      <span className="text-stone-800">{s.sector}</span>
                      <span className="text-emerald-600">
                        {s.performance_1d >= 0 ? '+' : ''}
                        {s.performance_1d.toFixed(2)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Laggards</p>
                <ul className="space-y-1">
                  {sectors
                    .slice()
                    .reverse()
                    .slice(0, 3)
                    .map((s) => (
                      <li key={s.sector} className="flex justify-between">
                        <span className="text-stone-800">{s.sector}</span>
                        <span className="text-red-600">
                          {s.performance_1d >= 0 ? '+' : ''}
                          {s.performance_1d.toFixed(2)}%
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Holdings</h2>
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-stone-50">
                  <th className="text-left p-3 font-medium">Ticker</th>
                  <th className="text-left p-3 font-medium">Shares</th>
                  <th className="text-right p-3 font-medium">Price</th>
                  <th className="text-right p-3 font-medium">Value</th>
                  <th className="text-right p-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {activeHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted">
                      No holdings.{' '}
                      <Link to="/portfolio" className="text-stone-700 underline">
                        Add in Portfolio
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  activeHoldings.map((h) => {
                    const q = quotes[h.ticker]
                    const value = q ? q.price * h.shares : null
                    return (
                      <tr key={h.id} className="border-b border-border last:border-0">
                        <td className="p-3 whitespace-nowrap">
                          <Link
                            to={`/stock/${h.ticker}`}
                            className="font-medium text-stone-800 hover:underline"
                          >
                            {h.ticker}
                          </Link>
                        </td>
                        <td className="p-3">{h.shares}</td>
                        <td className="p-3 text-right">
                          {q ? formatDisplayCurrency(q.price, displayCurrency, usdToCadRate) : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {value != null
                            ? formatDisplayCurrency(value, displayCurrency, usdToCadRate)
                            : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {scores[h.ticker]?.score != null ? (
                            <ScoreBadge score={Number(scores[h.ticker].score)} size="sm" />
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {alerts.filter((a) => !a.dismissed).length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted mb-2">Alerts</h2>
          <div className="space-y-2">
            {alerts.filter((a) => !a.dismissed).map((a) => (
              <AlertCard key={a.id} alert={a} onDismiss={handleDismissAlert} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">News</h2>
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          {news.length === 0 ? (
            <p className="p-4 text-sm text-muted">No recent headlines for your holdings.</p>
          ) : (
            <ul className="divide-y divide-border">
              {news.slice(0, 15).map((a, i) => (
                <li key={i} className="p-3">
                  <span className="text-xs font-medium text-stone-500 mr-2">{a.ticker}</span>
                  {a.sentiment_score != null && (
                    <span className={`text-xs ${a.sentiment_score > 0 ? 'text-emerald-600' : a.sentiment_score < 0 ? 'text-red-600' : 'text-muted'}`}>
                      {a.sentiment_score > 0 ? '↑' : a.sentiment_score < 0 ? '↓' : '—'}
                    </span>
                  )}
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="block mt-1 text-sm text-stone-800 hover:underline">
                    {a.headline}
                  </a>
                  <p className="text-xs text-muted mt-0.5">{a.source}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
