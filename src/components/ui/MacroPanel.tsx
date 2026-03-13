import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'

interface MacroIndicator {
  series_id: string
  name?: string
  unit?: string
  value?: number
  observation_date?: string
}

export default function MacroPanel() {
  const [indicators, setIndicators] = useState<MacroIndicator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<{ indicators: MacroIndicator[] }>('/market/macro')
      .then((r) => setIndicators(r.indicators ?? []))
      .catch(() => setIndicators([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-muted">Loading macro…</div>

  return (
    <div className="border border-border rounded-lg bg-white p-4">
      <h2 className="text-sm font-medium text-muted mb-3">Key macro indicators</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {indicators.map((ind) => (
          <div key={ind.series_id} className="text-sm">
            <p className="text-xs text-muted">{ind.name ?? ind.series_id}</p>
            <p className="font-medium">
              {ind.value != null ? ind.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
              {ind.unit ? ` ${ind.unit}` : ''}
            </p>
            {ind.observation_date && (
              <p className="text-xs text-muted">As of {ind.observation_date}</p>
            )}
          </div>
        ))}
      </div>
      {indicators.length === 0 && (
        <p className="text-sm text-muted">No macro data. Set FRED_API_KEY for Fed funds, CPI, 10Y yield.</p>
      )}
    </div>
  )
}
