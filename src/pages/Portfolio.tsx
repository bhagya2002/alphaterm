import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolioStore, type Holding, type AccountType, type Market } from '../store/portfolioStore'
import { useMarketStore } from '../store/marketStore'
import { useCurrencyStore, formatNativeAsDisplay } from '../store/currencyStore'
import { apiGet, apiPost, apiDelete } from '../lib/api'

const ACCOUNT_TYPES: AccountType[] = ['TFSA', 'FHSA', 'RRSP', 'Personal']
const MARKETS: Market[] = ['CAD', 'USD']

export default function Portfolio() {
  const holdings = usePortfolioStore((s) => s.holdings)
  const setHoldings = usePortfolioStore((s) => s.setHoldings)
  const removeHolding = usePortfolioStore((s) => s.removeHolding)
  const quotes = useMarketStore((s) => s.quotes)
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency)
  const usdToCadRate = useCurrencyStore((s) => s.usdToCadRate)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<Holding>>({
    ticker: '',
    company_name: '',
    exchange: '',
    market: 'USD',
    account_type: 'Personal',
    shares: 0,
    avg_cost: 0,
    date_opened: new Date().toISOString().slice(0, 10),
    notes: '',
    in_watchlist: false,
    is_active: true,
  })

  useEffect(() => {
    apiGet<{ holdings: Holding[] }>('/portfolio')
      .then((r) => {
        if (r.holdings) setHoldings(r.holdings)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setHoldings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ticker || !form.shares || form.shares <= 0) return
    try {
      const res = await apiPost<{ holding: Holding }>('/portfolio', {
        ticker: form.ticker.toUpperCase(),
        company_name: form.company_name || form.ticker,
        exchange: form.exchange || 'US',
        market: form.market ?? 'USD',
        account_type: form.account_type ?? 'Personal',
        shares: Number(form.shares),
        avg_cost: Number(form.avg_cost) || 0,
        date_opened: form.date_opened || new Date().toISOString().slice(0, 10),
        notes: form.notes || '',
        in_watchlist: form.in_watchlist ?? false,
        is_active: true,
      })
      if (res.holding) setHoldings([...holdings, res.holding])
      setShowForm(false)
      setForm({ ...form, ticker: '', company_name: '', shares: 0, avg_cost: 0 })
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this holding?')) return
    try {
      await apiDelete(`/portfolio/${id}`)
      removeHolding(id)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="text-muted">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Portfolio</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="text-sm font-medium text-stone-700 bg-white border border-border px-3 py-2 rounded-md hover:bg-stone-50"
        >
          {showForm ? 'Cancel' : 'Add holding'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-border rounded-lg bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Ticker *</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                placeholder="e.g. AAPL"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Company name</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Exchange</label>
              <input
                type="text"
                value={form.exchange}
                onChange={(e) => setForm({ ...form, exchange: e.target.value })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                placeholder="e.g. US, TSX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Market</label>
              <select
                value={form.market}
                onChange={(e) => setForm({ ...form, market: e.target.value as Market })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              >
                {MARKETS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Account type</label>
              <select
                value={form.account_type}
                onChange={(e) => setForm({ ...form, account_type: e.target.value as AccountType })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              >
                {ACCOUNT_TYPES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Shares *</label>
              <input
                type="number"
                min={0}
                step={0.0001}
                value={form.shares || ''}
                onChange={(e) => setForm({ ...form, shares: e.target.value ? Number(e.target.value) : 0 })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Avg. cost</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.avg_cost || ''}
                onChange={(e) => setForm({ ...form, avg_cost: e.target.value ? Number(e.target.value) : 0 })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Date opened</label>
              <input
                type="date"
                value={form.date_opened || ''}
                onChange={(e) => setForm({ ...form, date_opened: e.target.value })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Notes</label>
            <input
              type="text"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700">
              Add
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted hover:text-stone-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-stone-50">
                <th className="text-left p-3 font-medium">Ticker</th>
                <th className="text-left p-3 font-medium">Account</th>
                <th className="text-right p-3 font-medium">Shares</th>
                <th className="text-right p-3 font-medium">Avg cost</th>
                <th className="text-right p-3 font-medium">Price</th>
                <th className="text-right p-3 font-medium">Value</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {holdings.filter((h) => h.is_active).map((h) => {
                const q = quotes[h.ticker]
                const value = q ? q.price * h.shares : null
                const taxLossCandidate =
                  h.account_type === 'Personal' && q && q.price < h.avg_cost
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
                    <td className="p-3 text-muted whitespace-nowrap">
                      <span>{h.account_type}</span>
                      {taxLossCandidate && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
                          Tax‑loss candidate
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">{h.shares}</td>
                    <td className="p-3 text-right">
                      {formatNativeAsDisplay(
                        h.avg_cost,
                        h.market,
                        displayCurrency,
                        usdToCadRate
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {q
                        ? formatNativeAsDisplay(
                            q.price,
                            h.market,
                            displayCurrency,
                            usdToCadRate
                          )
                        : '—'}
                    </td>
                    <td className="p-3 text-right">
                      {value != null
                        ? formatNativeAsDisplay(
                            value,
                            h.market,
                            displayCurrency,
                            usdToCadRate
                          )
                        : '—'}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleRemove(h.id)}
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
        {holdings.length === 0 && (
          <p className="p-4 text-center text-muted text-sm">No holdings yet. Add one above.</p>
        )}
      </div>
    </div>
  )
}
