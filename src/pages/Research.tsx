import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../lib/api'
import ScoreBadge from '../components/ui/ScoreBadge'

interface Recommendation {
  ticker: string
  action: string
  shares_suggested: number | null
  reasoning: string | null
  run_at: string
}

interface DiscoveryItem {
  ticker: string
  esc_score: number
  esc_label: string | null
  ai_thesis: string | null
  run_at: string
}

interface Report {
  ticker: string
  ai_score: number | null
  report_json: { conclusion?: string; sections?: { full_text?: string } } | null
  generated_at: string
  research_source?: string | null
}

const ACTION_COLORS: Record<string, string> = {
  buy: 'bg-emerald-100 text-emerald-800',
  add: 'bg-emerald-100 text-emerald-800',
  sell: 'bg-red-100 text-red-800',
  reduce: 'bg-amber-100 text-amber-800',
  hold: 'bg-stone-100 text-stone-700',
}

export default function Research() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [discovery, setDiscovery] = useState<DiscoveryItem[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<{ recommendations: Recommendation[]; discovery: DiscoveryItem[]; reports: Report[] }>('/research')
      .then((r) => {
        setRecommendations(r.recommendations ?? [])
        setDiscovery(r.discovery ?? [])
        setReports(r.reports ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-muted">Loading…</div>

  const recsByTicker = new Map(recommendations.map((r) => [r.ticker.toUpperCase(), r]))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-800">Research</h1>
        <p className="text-sm text-muted mt-1">
          Unified view of AI recommendations, discovery candidates, and research reports. What to buy, hold, sell, or wait for.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted mb-3">Recommendations</h2>
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          {recommendations.length === 0 ? (
            <p className="p-4 text-sm text-muted">No recommendations yet. Run the recommendations job or check back after the next cron run.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recommendations.map((r, i) => (
                <li key={i} className="p-4 hover:bg-stone-50">
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[r.action] ?? 'bg-stone-100'}`}>
                      {r.action.toUpperCase()}
                    </span>
                    <Link to={`/stock/${r.ticker}`} className="font-medium text-stone-800 hover:underline shrink-0">
                      {r.ticker}
                    </Link>
                    {r.shares_suggested != null && (
                      <span className="text-muted text-sm shrink-0">{r.shares_suggested} shares</span>
                    )}
                    {r.reasoning && <span className="text-sm text-stone-600 flex-1">{r.reasoning}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-3">Discovery (ESC candidates)</h2>
        <p className="text-xs text-muted mb-2">Up-and-coming stocks from screener + AI thesis. Add to watchlist or generate a report.</p>
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          {discovery.length === 0 ? (
            <p className="p-4 text-sm text-muted">No discovery results. Run Discovery to populate.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-stone-50">
                    <th className="text-left p-3 font-medium">Ticker</th>
                    <th className="text-right p-3 font-medium">ESC</th>
                    <th className="text-left p-3 font-medium">AI thesis</th>
                    <th className="text-right p-3 font-medium">Rec</th>
                    <th className="text-right p-3 font-medium w-24" />
                  </tr>
                </thead>
                <tbody>
                  {discovery.map((d) => (
                    <tr key={d.ticker + d.run_at} className="border-b border-border last:border-0">
                      <td className="p-3">
                        <Link to={`/stock/${d.ticker}`} className="font-medium text-stone-800 hover:underline">{d.ticker}</Link>
                      </td>
                      <td className="p-3 text-right">
                        <ScoreBadge score={d.esc_score} size="sm" />
                        {d.esc_label && <span className="ml-1 text-muted text-xs">{d.esc_label}</span>}
                      </td>
                      <td className="p-3 max-w-md truncate text-muted" title={d.ai_thesis ?? ''}>{d.ai_thesis ?? '—'}</td>
                      <td className="p-3 text-right">
                        {recsByTicker.has(d.ticker.toUpperCase()) ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ACTION_COLORS[recsByTicker.get(d.ticker.toUpperCase())!.action] ?? ''}`}>
                            {recsByTicker.get(d.ticker.toUpperCase())!.action}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Link to={`/stock/${d.ticker}`} className="text-xs text-stone-600 hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-3">Research reports</h2>
        <p className="text-xs text-muted mb-2">Stocks with focused AI analysis (portfolio, watchlist, emerging). Each researched independently.</p>
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          {reports.length === 0 ? (
            <p className="p-4 text-sm text-muted">No reports yet. Generate from Discovery or Stock page.</p>
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((r) => {
                const conclusion = r.report_json?.sections?.full_text
                  ? r.report_json.sections.full_text.slice(0, 300) + (r.report_json.sections.full_text.length > 300 ? '…' : '')
                  : (r.report_json as { conclusion?: string })?.conclusion
                return (
                  <li key={r.ticker + r.generated_at} className="p-4 hover:bg-stone-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Link to={`/stock/${r.ticker}`} className="font-medium text-stone-800 hover:underline">
                          {r.ticker}
                        </Link>
                        {r.ai_score != null && (
                          <span className="ml-2"><ScoreBadge score={r.ai_score} size="sm" /></span>
                        )}
                        {r.research_source && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-stone-100 text-muted capitalize">{r.research_source}</span>
                        )}
                        {conclusion && (
                          <p className="mt-1 text-sm text-stone-600 line-clamp-2">{conclusion}</p>
                        )}
                        <p className="text-xs text-muted mt-0.5">{new Date(r.generated_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {recsByTicker.has(r.ticker.toUpperCase()) && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ACTION_COLORS[recsByTicker.get(r.ticker.toUpperCase())!.action] ?? ''}`}>
                            {recsByTicker.get(r.ticker.toUpperCase())!.action}
                          </span>
                        )}
                        <Link to={`/stock/${r.ticker}`} className="text-xs text-stone-600 hover:underline">Open</Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
