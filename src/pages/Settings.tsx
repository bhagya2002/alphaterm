import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'

interface SemanticResult {
  id: string
  ticker: string | null
  content_type: string
  content_text: string
  similarity: number
  created_at: string
}

interface Account {
  id: string
  name: string
  account_type: string
  cash_balance: number
  currency: string
}

interface Preferences {
  risk_tolerance: string
  sector_preferences: string[]
}

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'aggressive', label: 'Aggressive' },
]

const ACCOUNT_TYPES = ['TFSA', 'FHSA', 'RRSP', 'Personal']

export default function Settings() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SemanticResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<Preferences>({ risk_tolerance: 'moderate', sector_preferences: [] })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [newAccount, setNewAccount] = useState({ name: '', account_type: 'Personal', cash_balance: 0, currency: 'CAD' })
  const [savingPrefs, setSavingPrefs] = useState(false)

  useEffect(() => {
    apiGet<Preferences>('/preferences').then(setPreferences).catch(() => {})
    apiGet<{ accounts: Account[] }>('/accounts').then((r) => setAccounts(r.accounts ?? [])).catch(() => [])
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    try {
      const res = await apiGet<{ results: SemanticResult[] }>(`/search/semantic?q=${encodeURIComponent(q)}`)
      setResults(res.results ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSavePrefs = async () => {
    setSavingPrefs(true)
    try {
      const updated = await apiPatch<Preferences>('/preferences', preferences)
      setPreferences(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccount.name.trim()) return
    try {
      const res = await apiPost<{ account: Account }>('/accounts', newAccount)
      setAccounts([...accounts, res.account])
      setNewAccount({ name: '', account_type: 'Personal', cash_balance: 0, currency: 'CAD' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateCash = async (id: string, cash_balance: number) => {
    try {
      await apiPatch(`/accounts/${id}`, { cash_balance })
      setAccounts(accounts.map((a) => (a.id === id ? { ...a, cash_balance } : a)))
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Remove this account?')) return
    try {
      await apiDelete(`/accounts/${id}`)
      setAccounts(accounts.filter((a) => a.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-stone-800">Settings</h1>

      <section>
        <h2 className="text-sm font-medium text-muted mb-3">Risk & preferences</h2>
        <p className="text-sm text-muted mb-3">
          Your risk tolerance affects AI recommendations. Aggressive = higher conviction suggestions; Conservative = safer, lower-risk picks.
        </p>
        <div className="border border-border rounded-lg bg-white p-4 space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Risk tolerance</label>
            <select
              value={preferences.risk_tolerance}
              onChange={(e) => setPreferences({ ...preferences, risk_tolerance: e.target.value })}
              className="w-full border border-border rounded px-3 py-2 text-sm"
            >
              {RISK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleSavePrefs}
            disabled={savingPrefs}
            className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700 disabled:opacity-50"
          >
            {savingPrefs ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-3">Accounts & cash</h2>
        <p className="text-sm text-muted mb-3">
          Add brokerage accounts and cash balances so the AI can recommend how much to buy based on available funds.
        </p>
        <form onSubmit={handleAddAccount} className="border border-border rounded-lg bg-white p-4 space-y-3 max-w-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Account name</label>
              <input
                type="text"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                placeholder="e.g. Questrade TFSA"
                className="w-full border border-border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Type</label>
              <select
                value={newAccount.account_type}
                onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Cash balance</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={newAccount.cash_balance || ''}
                onChange={(e) => setNewAccount({ ...newAccount, cash_balance: Number(e.target.value) || 0 })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Currency</label>
              <select
                value={newAccount.currency}
                onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                className="w-full border border-border rounded px-3 py-2 text-sm"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <button type="submit" className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700">
            Add account
          </button>
        </form>

        {accounts.length > 0 && (
          <div className="border border-border rounded-lg bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-stone-50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Cash</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="p-3">{a.name}</td>
                    <td className="p-3 text-muted">{a.account_type}</td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={a.cash_balance}
                        onBlur={(e) => {
                          const v = Number(e.target.value)
                          if (!isNaN(v) && v !== a.cash_balance) handleUpdateCash(a.id, v)
                        }}
                        className="w-24 text-right border border-border rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="p-3">
                      <button type="button" onClick={() => handleDeleteAccount(a.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Semantic search (reports &amp; news)</h2>
        <form onSubmit={handleSearch} className="border border-border rounded-lg bg-white p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search research reports and news (e.g. AAPL guidance, AI demand)"
              className="flex-1 border border-border rounded px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="text-sm font-medium bg-stone-800 text-white px-4 py-2 rounded-md hover:bg-stone-700 disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && !searching && results.length === 0 && query.trim() && (
            <p className="text-sm text-muted">No matches found. Ensure embeddings have been ingested.</p>
          )}
        </form>
        {results.length > 0 && (
          <div className="mt-3 border border-border rounded-lg bg-white p-4 space-y-3">
            {results.map((r) => (
              <div key={r.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-800">{r.ticker ?? 'Untagged'} · {r.content_type}</span>
                  <span className="text-xs text-muted">{(r.similarity * 100).toFixed(0)}% match</span>
                </div>
                <p className="mt-1 text-sm text-stone-700 line-clamp-3">{r.content_text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
