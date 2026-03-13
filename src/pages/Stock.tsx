import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMarketStore } from '../store/marketStore'
import { apiGet, apiPost } from '../lib/api'

interface ReportRow {
  id: string
  ticker: string
  report_json: { sections?: { full_text?: string }; full_text?: string }
  ai_score: number | null
  provider_used: string | null
  model_used: string | null
  generated_at: string
}

interface FilingSummary {
  id?: string
  ticker: string
  filing_type: string | null
  filing_date: string | null
  source: string | null
  source_url: string | null
  summary_text: string | null
}

interface EarningsSummary {
  id?: string
  ticker: string
  call_date: string | null
  source: string | null
  source_url: string | null
  summary_text: string | null
  sentiment_label: string | null
}

export default function Stock() {
  const { ticker } = useParams<{ ticker: string }>()
  const quotes = useMarketStore((s) => s.quotes)
  const q = ticker ? quotes[ticker] : undefined
  const [report, setReport] = useState<ReportRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [filings, setFilings] = useState<FilingSummary[] | null>(null)
  const [filingsLoading, setFilingsLoading] = useState(false)
  const [filingsError, setFilingsError] = useState<string | null>(null)
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null)
  const [earningsMessage, setEarningsMessage] = useState<string | null>(null)
  const [earningsLoading, setEarningsLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    apiGet<{ report: ReportRow | null }>(`/reports?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => { setReport(r.report ?? null) })
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [ticker])

  useEffect(() => {
    if (!ticker) return
    setFilingsLoading(true)
    setFilingsError(null)
    apiGet<{ summaries: FilingSummary[]; message?: string }>(
      `/filings/summary?ticker=${encodeURIComponent(ticker)}`
    )
      .then((r) => {
        setFilings(r.summaries ?? [])
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load filings.'
        setFilingsError(message)
        setFilings(null)
      })
      .finally(() => setFilingsLoading(false))
  }, [ticker])

  useEffect(() => {
    if (!ticker) return
    setEarningsLoading(true)
    setEarningsMessage(null)
    setEarningsSummary(null)
    apiGet<{ summary?: EarningsSummary; message?: string; status: string }>(
      `/earnings/transcript?ticker=${encodeURIComponent(ticker)}`
    )
      .then((r) => {
        if (r.summary) {
          setEarningsSummary(r.summary)
        } else if (r.message) {
          setEarningsMessage(r.message)
        } else {
          setEarningsMessage('Transcript analysis coming soon.')
        }
      })
      .catch(() => {
        setEarningsMessage('Transcript analysis coming soon.')
      })
      .finally(() => setEarningsLoading(false))
  }, [ticker])

  const handleGenerateReport = () => {
    if (!ticker) return
    setGenerating(true)
    apiPost<{ report: ReportRow }>('/reports/generate', { ticker })
      .then((r) => { setReport(r.report) })
      .catch(() => {})
      .finally(() => setGenerating(false))
  }

  const reportText = report?.report_json?.sections?.full_text ?? report?.report_json?.full_text ?? null

  if (!ticker) return <div className="text-muted">No ticker</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/watchlist" className="text-muted hover:text-stone-700">← Back</Link>
      </div>
      <h1 className="text-xl font-semibold text-stone-800">{ticker}</h1>
      <div className="border border-border rounded-lg bg-white p-4">
        <p className="text-sm text-muted">Price</p>
        <p className="text-2xl font-medium">{q ? q.price.toFixed(2) : '—'}</p>
        {q?.change != null && (
          <p className={q.change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {q.change >= 0 ? '↑' : '↓'} {Math.abs(q.change).toFixed(2)} ({q.changePercent != null ? (q.changePercent >= 0 ? '+' : '') + q.changePercent.toFixed(2) + '%' : ''})
          </p>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-muted">Research report</h2>
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={generating || loading}
            className="text-sm px-3 py-1.5 rounded bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate report'}
          </button>
        </div>
        <div className="border border-border rounded-lg bg-white p-4">
          {loading && !report ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : reportText ? (
            <div className="prose prose-sm max-w-none text-stone-700 whitespace-pre-wrap">{reportText}</div>
          ) : report ? (
            <p className="text-sm text-muted">Report has no text content.</p>
          ) : (
            <p className="text-sm text-muted">No report yet. Click “Generate report” to create one.</p>
          )}
          {report && (report.provider_used || report.ai_score != null) && (
            <p className="mt-3 text-xs text-muted">
              {report.provider_used && <span>Provider: {report.provider_used}</span>}
              {report.ai_score != null && <span className="ml-2">Score: {Number(report.ai_score).toFixed(1)}</span>}
              {report.generated_at && <span className="ml-2">{new Date(report.generated_at).toLocaleString()}</span>}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Filing summary</h2>
        <div className="border border-border rounded-lg bg-white p-4 space-y-2">
          {filingsLoading && <p className="text-sm text-muted">Loading filings…</p>}
          {filingsError && (
            <p className="text-sm text-red-600">
              {filingsError}
            </p>
          )}
          {!filingsLoading && !filingsError && (filings == null || filings.length === 0) && (
            <p className="text-sm text-muted">
              No recent filing summary available yet for this ticker.
            </p>
          )}
          {filings && filings.length > 0 && (
            <div className="space-y-3">
              {filings.map((f, idx) => (
                <div key={f.id ?? idx} className="text-sm text-stone-700">
                  <p className="font-medium">
                    {f.filing_type ?? 'Filing'}{' '}
                    {f.filing_date && (
                      <span className="text-xs text-muted ml-1">
                        ({new Date(f.filing_date).toLocaleDateString()})
                      </span>
                    )}
                  </p>
                  {f.summary_text && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">
                      {f.summary_text}
                    </p>
                  )}
                  {f.source_url && (
                    <a
                      href={f.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-stone-600 underline"
                    >
                      View filing
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Earnings summary</h2>
        <div className="border border-border rounded-lg bg-white p-4 space-y-2">
          {earningsLoading && <p className="text-sm text-muted">Loading earnings call…</p>}
          {!earningsLoading && !earningsSummary && (
            <p className="text-sm text-muted">
              {earningsMessage || 'Transcript analysis coming soon.'}
            </p>
          )}
          {earningsSummary && (
            <div className="text-sm text-stone-700">
              <p className="font-medium">
                Latest call{' '}
                {earningsSummary.call_date && (
                  <span className="text-xs text-muted ml-1">
                    ({new Date(earningsSummary.call_date).toLocaleDateString()})
                  </span>
                )}
              </p>
              {earningsSummary.sentiment_label && (
                <p className="text-xs text-muted mt-0.5">
                  Sentiment: {earningsSummary.sentiment_label}
                </p>
              )}
              {earningsSummary.summary_text && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">
                  {earningsSummary.summary_text}
                </p>
              )}
              {earningsSummary.source_url && (
                <a
                  href={earningsSummary.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-stone-600 underline"
                >
                  View full transcript
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
