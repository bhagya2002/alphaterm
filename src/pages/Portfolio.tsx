import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolioStore, type Holding, type AccountType, type Market } from '../store/portfolioStore'
import { useMarketStore } from '../store/marketStore'
import { useCurrencyStore, formatNativeAsDisplay } from '../store/currencyStore'
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'

const ACCOUNT_TYPES: AccountType[] = ['TFSA', 'FHSA', 'RRSP', 'Personal']
const MARKETS: Market[] = ['CAD', 'USD']

export default function Portfolio() {
  const holdings = usePortfolioStore((s) => s.holdings)
  const setHoldings = usePortfolioStore((s) => s.setHoldings)
  const updateHolding = usePortfolioStore((s) => s.updateHolding)
  const removeHolding = usePortfolioStore((s) => s.removeHolding)
  const quotes = useMarketStore((s) => s.quotes)
  const setQuotes = useMarketStore((s) => s.setQuotes)
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency)
  const usdToCadRate = useCurrencyStore((s) => s.usdToCadRate)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTx, setShowTx] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Holding>>({
    ticker: '',
    company_name: '',
    exchange: '',
    market: 'USD',
    account_type: 'Personal',
    shares: 0,
    avg_cost: 0,
    target_sell_price: undefined,
    date_opened: new Date().toISOString().slice(0, 10),
    notes: '',
    in_watchlist: false,
    is_active: true,
  })
  const [quickAdd, setQuickAdd] = useState({ ticker: '', shares: 0, avg_cost: 0, target_sell_price: 0 as number | '' })
  const [txForm, setTxForm] = useState({ type: 'buy' as 'buy' | 'sell', shares: 0, price: 0, notes: '' })

  const activeHoldings = holdings.filter((h) => h.is_active)

  useEffect(() => {
    apiGet<{ holdings: Holding[] }>('/portfolio')
      .then((r) => {
        if (r.holdings) setHoldings(r.holdings)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setHoldings])

  useEffect(() => {
    const missing = activeHoldings.filter((h) => !quotes[h.ticker]).map((h) => h.ticker)
    if (missing.length === 0) return
    apiGet<{ quotes: Record<string, { price: number }> }>(`/market/quotes?symbols=${encodeURIComponent(missing.join(','))}`)
      .then((r) => {
        if (r.quotes) {
          const next: Record<string, { symbol: string; price: number; updatedAt: number }> = {}
          for (const [sym, q] of Object.entries(r.quotes)) {
            next[sym] = { symbol: sym, price: q.price, updatedAt: Date.now() }
          }
          setQuotes(next)
        }
      })
      .catch(() => {})
  }, [activeHoldings.map((h) => h.ticker).join(','), setQuotes])

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
        target_sell_price: form.target_sell_price && Number(form.target_sell_price) > 0 ? Number(form.target_sell_price) : undefined,
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

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickAdd.ticker || !quickAdd.shares || quickAdd.shares <= 0) return
    try {
      const res = await apiPost<{ holding: Holding }>('/portfolio', {
        ticker: quickAdd.ticker.toUpperCase(),
        company_name: quickAdd.ticker,
        exchange: 'US',
        market: 'USD',
        account_type: 'Personal',
        shares: Number(quickAdd.shares),
        avg_cost: Number(quickAdd.avg_cost) || 0,
        target_sell_price: quickAdd.target_sell_price && Number(quickAdd.target_sell_price) > 0 ? Number(quickAdd.target_sell_price) : undefined,
        date_opened: new Date().toISOString().slice(0, 10),
        notes: '',
        in_watchlist: false,
        is_active: true,
      })
      if (res.holding) setHoldings([...holdings, res.holding])
      setShowQuickAdd(false)
      setQuickAdd({ ticker: '', shares: 0, avg_cost: 0, target_sell_price: '' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = (h: Holding) => {
    setEditingId(h.id)
    setForm({
      ticker: h.ticker,
      company_name: h.company_name,
      exchange: h.exchange,
      market: h.market,
      account_type: h.account_type,
      shares: h.shares,
      avg_cost: h.avg_cost,
      target_sell_price: h.target_sell_price ?? undefined,
      date_opened: h.date_opened || '',
      notes: h.notes || '',
      in_watchlist: h.in_watchlist,
    })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    try {
      const res = await apiPatch<{ holding: Holding }>(`/portfolio/${editingId}`, {
        ticker: form.ticker?.toUpperCase(),
        company_name: form.company_name,
        exchange: form.exchange,
        market: form.market,
        account_type: form.account_type,
        shares: Number(form.shares),
        avg_cost: Number(form.avg_cost),
        target_sell_price: form.target_sell_price && Number(form.target_sell_price) > 0 ? Number(form.target_sell_price) : null,
        date_opened: form.date_opened,
        notes: form.notes,
        in_watchlist: form.in_watchlist,
      })
      if (res.holding) updateHolding(editingId, res.holding)
      setEditingId(null)
    } catch (err) {
      console.error(err)
    }
  }

  const handleRecordTx = async (holdingId: string) => {
    if (!txForm.shares || txForm.shares <= 0 || !txForm.price || txForm.price <= 0) return
    try {
      await apiPost('/transactions', {
        holding_id: holdingId,
        type: txForm.type,
        shares: txForm.shares,
        price: txForm.price,
        notes: txForm.notes || undefined,
      })
      const r = await apiGet<{ holdings: Holding[] }>('/portfolio')
      if (r.holdings) setHoldings(r.holdings)
      setShowTx(null)
      setTxForm({ type: 'buy', shares: 0, price: 0, notes: '' })
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowQuickAdd(true); setShowForm(false) }}
            className="text-sm font-medium bg-stone-800 text-white px-3 py-2 rounded-md hover:bg-stone-700"
          >
            Quick add
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setShowQuickAdd(false) }}
            className="text-sm font-medium text-stone-700 bg-white border border-border px-3 py-2 rounded-md hover:bg-stone-50"
          >
            {showForm ? 'Cancel' : 'Add holding'}
          </button>
        </div>
      </div>

      {showQuickAdd && (
        <form onSubmit={handleQuickAdd} className="border border-border rounded-lg bg-white p-4 space-y-3 max-w-2xl">
          <h3 className="text-sm font-medium text-stone-800">Quick add (ticker, shares, avg cost, target sell)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Ticker *</label>
              <input
                type="text"
                value={quickAdd.ticker}
                onChange={(e) => setQuickAdd({ ...quickAdd, ticker: e.target.value })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                placeholder="AAPL"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Shares *</label>
              <input
                type="number"
                min={0}
                step={0.0001}
                value={quickAdd.shares || ''}
                onChange={(e) => setQuickAdd({ ...quickAdd, shares: e.target.value ? Number(e.target.value) : 0 })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Avg cost</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={quickAdd.avg_cost || ''}
                onChange={(e) => setQuickAdd({ ...quickAdd, avg_cost: e.target.value ? Number(e.target.value) : 0 })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1" title="Target price to sell at (AI will consider but can recommend sell above/below)">Target sell $</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={quickAdd.target_sell_price || ''}
                onChange={(e) => setQuickAdd({ ...quickAdd, target_sell_price: e.target.value ? Number(e.target.value) : '' })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700">Add</button>
            <button type="button" onClick={() => setShowQuickAdd(false)} className="text-sm text-muted hover:text-stone-700">Cancel</button>
          </div>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-border rounded-lg bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Ticker *</label>
              <input type="text" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} className="w-full border border-border rounded px-3 py-2 text-sm" placeholder="e.g. AAPL" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Company name</label>
              <input type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full border border-border rounded px-3 py-2 text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Exchange</label>
              <input type="text" value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })} className="w-full border border-border rounded px-3 py-2 text-sm" placeholder="e.g. US, TSX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Market</label>
              <select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as Market })} className="w-full border border-border rounded px-3 py-2 text-sm">
                {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Account type</label>
              <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value as AccountType })} className="w-full border border-border rounded px-3 py-2 text-sm">
                {ACCOUNT_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Shares *</label>
              <input type="number" min={0} step={0.0001} value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: e.target.value ? Number(e.target.value) : 0 })} className="w-full border border-border rounded px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Avg. cost</label>
              <input type="number" min={0} step={0.01} value={form.avg_cost || ''} onChange={(e) => setForm({ ...form, avg_cost: e.target.value ? Number(e.target.value) : 0 })} className="w-full border border-border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1" title="Target price to sell at (AI considers, can recommend above/below)">Target sell $</label>
              <input type="number" min={0} step={0.01} value={form.target_sell_price ?? ''} onChange={(e) => setForm({ ...form, target_sell_price: e.target.value ? Number(e.target.value) : undefined })} className="w-full border border-border rounded px-3 py-2 text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Date opened</label>
              <input type="date" value={form.date_opened || ''} onChange={(e) => setForm({ ...form, date_opened: e.target.value })} className="w-full border border-border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Notes</label>
            <input type="text" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-border rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted hover:text-stone-700">Cancel</button>
          </div>
        </form>
      )}

      {editingId && (
        <form onSubmit={handleEditSubmit} className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-stone-800">Edit holding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted mb-1">Ticker</label><input type="text" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} className="w-full border border-border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-muted mb-1">Account</label><select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value as AccountType })} className="w-full border border-border rounded px-3 py-2 text-sm">{ACCOUNT_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-muted mb-1">Shares</label><input type="number" min={0} value={form.shares} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) || 0 })} className="w-full border border-border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-muted mb-1">Avg cost</label><input type="number" min={0} value={form.avg_cost} onChange={(e) => setForm({ ...form, avg_cost: Number(e.target.value) || 0 })} className="w-full border border-border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-muted mb-1">Target sell $</label><input type="number" min={0} step={0.01} value={form.target_sell_price ?? ''} onChange={(e) => setForm({ ...form, target_sell_price: e.target.value ? Number(e.target.value) : undefined })} className="w-full border border-border rounded px-3 py-2 text-sm" placeholder="Optional" /></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700">Save</button>
            <button type="button" onClick={() => setEditingId(null)} className="text-sm text-muted hover:text-stone-700">Cancel</button>
          </div>
        </form>
      )}

      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-stone-50">
                <th className="text-left p-3 font-medium">Ticker</th>
                <th className="text-left p-3 font-medium">Account</th>
                <th className="text-right p-3 font-medium">Shares</th>
                <th className="text-right p-3 font-medium">Avg cost</th>
                <th className="text-right p-3 font-medium">Price</th>
                <th className="text-right p-3 font-medium">Target sell</th>
                <th className="text-right p-3 font-medium">Value</th>
                <th className="text-right p-3 font-medium w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeHoldings.map((h) => {
                const q = quotes[h.ticker]
                const value = q ? q.price * h.shares : null
                const taxLossCandidate = h.account_type === 'Personal' && q && q.price < h.avg_cost
                return (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="p-3 whitespace-nowrap">
                      <Link to={`/stock/${h.ticker}`} className="font-medium text-stone-800 hover:underline">{h.ticker}</Link>
                    </td>
                    <td className="p-3 text-muted whitespace-nowrap">
                      <span>{h.account_type}</span>
                      {taxLossCandidate && <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">Tax‑loss</span>}
                    </td>
                    <td className="p-3 text-right">{h.shares}</td>
                    <td className="p-3 text-right">{formatNativeAsDisplay(h.avg_cost, h.market, displayCurrency, usdToCadRate)}</td>
                    <td className="p-3 text-right">{q ? formatNativeAsDisplay(q.price, h.market, displayCurrency, usdToCadRate) : '—'}</td>
                    <td className="p-3 text-right">{h.target_sell_price ? formatNativeAsDisplay(h.target_sell_price, h.market, displayCurrency, usdToCadRate) : '—'}</td>
                    <td className="p-3 text-right">{value != null ? formatNativeAsDisplay(value, h.market, displayCurrency, usdToCadRate) : '—'}</td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <button type="button" onClick={() => handleEdit(h)} className="text-xs text-stone-600 hover:underline">Edit</button>
                        <button type="button" onClick={() => setShowTx(showTx === h.id ? null : h.id)} className="text-xs text-stone-600 hover:underline">Record buy/sell</button>
                        <button type="button" onClick={() => handleRemove(h.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                      </div>
                      {showTx === h.id && (
                        <div className="mt-2 p-2 bg-stone-50 rounded border border-border space-y-2">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setTxForm({ ...txForm, type: 'buy' })} className={`text-xs px-2 py-1 rounded ${txForm.type === 'buy' ? 'bg-emerald-600 text-white' : 'bg-stone-200'}`}>Buy</button>
                            <button type="button" onClick={() => setTxForm({ ...txForm, type: 'sell' })} className={`text-xs px-2 py-1 rounded ${txForm.type === 'sell' ? 'bg-red-600 text-white' : 'bg-stone-200'}`}>Sell</button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input type="number" placeholder="Shares" value={txForm.shares || ''} onChange={(e) => setTxForm({ ...txForm, shares: Number(e.target.value) || 0 })} className="border rounded px-2 py-1 text-xs" />
                            <input type="number" placeholder="Price" step={0.01} value={txForm.price || ''} onChange={(e) => setTxForm({ ...txForm, price: Number(e.target.value) || 0 })} className="border rounded px-2 py-1 text-xs" />
                            <button type="button" onClick={() => handleRecordTx(h.id)} className="text-xs bg-stone-800 text-white px-2 py-1 rounded">Save</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {activeHoldings.length === 0 && <p className="p-4 text-center text-muted text-sm">No holdings yet. Add one above.</p>}
      </div>
    </div>
  )
}
