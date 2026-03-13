import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useCurrencyStore } from '../../store/currencyStore'
import { apiFetch, apiGet } from '../../lib/api'

export default function TopBar() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency)
  const setDisplayCurrency = useCurrencyStore((s) => s.setDisplayCurrency)
  const setUsdToCadRate = useCurrencyStore((s) => s.setUsdToCadRate)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      logout()
      navigate('/', { replace: true })
    }
  }

  const toggleCurrency = async () => {
    const next = displayCurrency === 'USD' ? 'CAD' : 'USD'
    if (next === 'CAD') {
      try {
        const res = await apiGet<{ rate: number }>('/market/fx')
        if (res.rate != null) setUsdToCadRate(res.rate)
      } catch {
        setUsdToCadRate(null)
      }
    }
    setDisplayCurrency(next)
  }

  return (
    <header className="h-12 border-b border-border bg-white flex items-center justify-between px-4 md:px-6 relative">
      <div className="flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-xs text-stone-700 bg-white"
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <Link to="/dashboard" className="font-medium text-stone-800">
          AlphaTerm
        </Link>
      </div>
      <div className="hidden md:block font-semibold text-stone-800">AlphaTerm</div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleCurrency}
          className="text-sm text-muted hover:text-stone-700"
          title={displayCurrency === 'USD' ? 'Switch to CAD' : 'Switch to USD'}
        >
          Show in {displayCurrency === 'USD' ? 'CAD' : 'USD'}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-muted hover:text-stone-700"
        >
          Sign out
        </button>
      </div>
      {menuOpen && (
        <div className="absolute left-0 top-12 w-full bg-white border-b border-border shadow-sm md:hidden z-10">
          <nav className="px-4 py-2 space-y-1 text-sm">
            <Link
              to="/dashboard"
              className="block px-2 py-1 rounded hover:bg-stone-50 text-stone-800"
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/portfolio"
              className="block px-2 py-1 rounded hover:bg-stone-50 text-stone-800"
              onClick={() => setMenuOpen(false)}
            >
              Portfolio
            </Link>
            <Link
              to="/watchlist"
              className="block px-2 py-1 rounded hover:bg-stone-50 text-stone-800"
              onClick={() => setMenuOpen(false)}
            >
              Watchlist
            </Link>
            <Link
              to="/discovery"
              className="block px-2 py-1 rounded hover:bg-stone-50 text-stone-800"
              onClick={() => setMenuOpen(false)}
            >
              Discovery
            </Link>
            <Link
              to="/chat"
              className="block px-2 py-1 rounded hover:bg-stone-50 text-stone-800"
              onClick={() => setMenuOpen(false)}
            >
              Chat
            </Link>
            <Link
              to="/screener"
              className="block px-2 py-1 rounded hover:bg-stone-50 text-stone-800"
              onClick={() => setMenuOpen(false)}
            >
              Screener
            </Link>
            <Link
              to="/settings"
              className="block px-2 py-1 rounded hover:bg-stone-50 text-stone-800"
              onClick={() => setMenuOpen(false)}
            >
              Settings
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
