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

interface NewsArticle {
  ticker: string
  headline: string
  summary?: string | null
  source: string
  url: string
  sentiment_score: number | null
}

interface Recommendation {
  ticker: string
  action: string
  shares_suggested: number | null
  reasoning: string | null
  run_at: string
}

interface Account {
  id: string
  name: string
  account_type: string
  cash_balance: number
  currency: string
}

export default function Dashboard() {
  const holdings = usePortfolioStore((s) => s.holdings)
  const quotes = useMarketStore((s) => s.quotes)
  const setQuotes = useMarketStore((s) => s.setQuotes)
  const alerts = useAlertStore((s) => s.alerts)
  const setHoldings = usePortfolioStore((s) => s.setHoldings)
  const setAlerts = useAlertStore((s) => s.setAlerts)
  const dismissAlert = useAlertStore((s) => s.dismissAlert)
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency)
  const usdToCadRate = useCurrencyStore((s) => s.usdToCadRate)
  const [scores, setScores] = useState<Record<string, StockScore>>({})
  const [news, setNews] = useState<NewsArticle[]>([])
  const [sectors, setSectors] = useState<SectorRotationItem[]>([])
  const [sectorNarrative, setSectorNarrative] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recommendationsRunAt, setRecommendationsRunAt] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])

  const activeHoldings = useMemo(() => holdings.filter((h) => h.is_active), [holdings])
  const scoreTickers = useMemo(() => activeHoldings.map((h) => h.ticker).join(','), [activeHoldings])

  useEffect(() => {
    apiGet<{ holdings: typeof holdings }>('/portfolio').then((r) => r.holdings && setHoldings(r.holdings)).catch(() => {})
    apiGet<{ alerts: typeof alerts }>('/alerts').then((r) => r.alerts && setAlerts(r.alerts)).catch(() => {})
  }, [setHoldings, setAlerts])

  useEffect(() => {
    apiGet<{ accounts: Account[] }>('/accounts').then((r) => setAccounts(r.accounts ?? [])).catch(() => setAccounts([]))
  }, [])

  useEffect(() => {
    if (activeHoldings.length === 0) return
    const missing = activeHoldings.filter((h) => !quotes[h.ticker]).map((h) => h.ticker)
    if (missing.length > 0) {
      apiGet<{ quotes: Record<string, { price: number; change?: number; changePercent?: number }> }>(
        `/market/quotes?symbols=${encodeURIComponent(missing.join(','))}`
      )
        .then((r) => {
          if (r.quotes) {
            const next: Record<string, { symbol: string; price: number; change?: number; changePercent?: number; updatedAt: number }> = {}
            for (const [sym, q] of Object.entries(r.quotes)) {
              next[sym] = {
                symbol: sym,
                price: q.price,
                change: q.change,
                changePercent: q.changePercent,
                updatedAt: Date.now(),
              }
            }
            setQuotes(next)
          }
        })
        .catch(() => {})
    }
  }, [scoreTickers, activeHoldings.length, setQuotes])

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
    apiGet<{ articles: NewsArticle[] }>(`/news?tickers=${encodeURIComponent(scoreTickers)}`)
      .then((r) => setNews(r.articles ?? []))
      .catch(() => {})
  }, [scoreTickers, activeHoldings.length])

  useEffect(() => {
    apiGet<{ sectors: SectorRotationItem[]; narrative?: string | null }>('/market/sector-rotation')
      .then((r) => {
        setSectors(r.sectors ?? [])
        setSectorNarrative(r.narrative ?? null)
      })
      .catch(() => { setSectors([]); setSectorNarrative(null) })
  }, [])

  useEffect(() => {
    apiGet<{ recommendations: Recommendation[]; run_at: string | null }>('/recommendations')
      .then((r) => {
        setRecommendations(r.recommendations ?? [])
        setRecommendationsRunAt(r.run_at ?? null)
      })
      .catch(() => {})
  }, [])

  const totalValue = useMemo(() => {
    return activeHoldings.reduce((sum, h) => {
      const q = quotes[h.ticker]
      if (!q) return sum
      return sum + q.price * h.shares
    }, 0)
  }, [activeHoldings, quotes])

  const totalCost = useMemo(
    () => activeHoldings.reduce((sum, h) => sum + h.avg_cost * h.shares, 0),
    [activeHoldings]
  )
  const pnl = totalValue - totalCost
  const pnlPct = totalCost ? (pnl / totalCost) * 100 : 0

  const totalCash = useMemo(
    () => accounts.reduce((s, a) => s + Number(a.cash_balance ?? 0), 0),
    [accounts]
  )

  const handleDismissAlert = (id: string) => {
    apiPatch(`/alerts/${id}`, { dismissed: true }).then(() => dismissAlert(id)).catch(() => {})
  }

  const actionColors: Record<string, string> = {
    buy: 'bg-emerald-100 text-emerald-800',
    add: 'bg-emerald-100 text-emerald-800',
    sell: 'bg-red-100 text-red-800',
    reduce: 'bg-amber-100 text-amber-800',
    hold: 'bg-stone-100 text-stone-700',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Dashboard</h1>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
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
                <div>
                  <p className="text-xs text-muted">Cash available</p>
                  <p className="font-medium">{formatDisplayCurrency(totalCash, displayCurrency, usdToCadRate)}</p>
                </div>
              </div>
            </div>
          </section>

          {recommendations.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted mb-2">AI recommendations</h2>
              <div className="border border-border rounded-lg bg-white p-4 space-y-3">
                {recommendationsRunAt && (
                  <p className="text-xs text-muted">Last run: {new Date(recommendationsRunAt).toLocaleString()}</p>
                )}
                <ul className="space-y-2">
                  {recommendations.slice(0, 10).map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${actionColors[r.action] ?? 'bg-stone-100'}`}>
                        {r.action.toUpperCase()}
                      </span>
                      <Link to={`/stock/${r.ticker}`} className="font-medium text-stone-800 hover:underline shrink-0">{r.ticker}</Link>
                      {r.shares_suggested != null && <span className="text-muted">{r.shares_suggested} shares</span>}
                      {r.reasoning && <span className="text-muted flex-1">{r.reasoning}</span>}
                    </li>
                  ))}
                </ul>
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
                          No holdings. <Link to="/portfolio" className="text-stone-700 underline">Add in Portfolio</Link>.
                        </td>
                      </tr>
                    ) : (
                      activeHoldings.map((h) => {
                        const q = quotes[h.ticker]
                        const value = q ? q.price * h.shares : null
                        return (
                          <tr key={h.id} className="border-b border-border last:border-0">
                            <td className="p-3 whitespace-nowrap">
                              <Link to={`/stock/${h.ticker}`} className="font-medium text-stone-800 hover:underline">{h.ticker}</Link>
                            </td>
                            <td className="p-3">{h.shares}</td>
                            <td className="p-3 text-right">
                              {q ? formatDisplayCurrency(q.price, displayCurrency, usdToCadRate) : '—'}
                            </td>
                            <td className="p-3 text-right">
                              {value != null ? formatDisplayCurrency(value, displayCurrency, usdToCadRate) : '—'}
                            </td>
                            <td className="p-3 text-right">
                              {scores[h.ticker]?.score != null ? <ScoreBadge score={Number(scores[h.ticker].score)} size="sm" /> : '—'}
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
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-medium text-muted mb-2">Macro</h2>
            <MacroPanel />
          </section>

          {sectors.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted mb-2">Sector rotation</h2>
              <div className="border border-border rounded-lg bg-white p-4 space-y-3">
                {sectorNarrative && <p className="text-sm text-stone-700 whitespace-pre-wrap">{sectorNarrative}</p>}
                <div className="space-y-2 text-sm">
                  {sectors.slice(0, 5).map((s) => (
                    <div key={s.sector} className="flex justify-between">
                      <span className="text-stone-800">{s.sector}</span>
                      <span className={s.performance_1d >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {s.performance_1d >= 0 ? '+' : ''}{s.performance_1d.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

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
            <h2 className="text-sm font-medium text-muted mb-2">News summaries</h2>
            <div className="border border-border rounded-lg bg-white overflow-hidden max-h-[400px] overflow-y-auto">
              {news.length === 0 ? (
                <p className="p-4 text-sm text-muted">No recent news for your holdings.</p>
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
                      <p className="mt-1 text-sm text-stone-800">
                        {a.summary || a.headline}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{a.source}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {accounts.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted mb-2">Accounts & cash</h2>
              <div className="border border-border rounded-lg bg-white p-4 space-y-2">
                {accounts.map((a) => (
                  <div key={a.id} className="flex justify-between text-sm">
                    <span className="text-stone-800">{a.name} ({a.account_type})</span>
                    <span className="font-medium">{formatDisplayCurrency(Number(a.cash_balance), displayCurrency, usdToCadRate)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
