import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { apiGet } from './lib/api'
import PinGate from './pages/PinGate'
import Dashboard from './pages/Dashboard'
import Layout from './components/layout/Layout'
import Portfolio from './pages/Portfolio'
import Watchlist from './pages/Watchlist'
import Research from './pages/Research'
import Discovery from './pages/Discovery'
import Stock from './pages/Stock'
import Chat from './pages/Chat'
import Screener from './pages/Screener'
import Settings from './pages/Settings'

function AuthChecker({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated)

  useEffect(() => {
    apiGet<{ ok: boolean }>('/auth/me')
      .then((r) => r.ok && setAuthenticated(true))
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false))
  }, [setAuthenticated])

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center text-muted">Loading…</div>
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthChecker>
    <Routes>
      <Route path="/" element={<PinGate />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/portfolio"
        element={
          <ProtectedRoute>
            <Layout>
              <Portfolio />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/research"
        element={
          <ProtectedRoute>
            <Layout>
              <Research />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/watchlist"
        element={
          <ProtectedRoute>
            <Layout>
              <Watchlist />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/discovery"
        element={
          <ProtectedRoute>
            <Layout>
              <Discovery />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock/:ticker"
        element={
          <ProtectedRoute>
            <Layout>
              <Stock />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Layout>
              <Chat />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/screener"
        element={
          <ProtectedRoute>
            <Layout>
              <Screener />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </AuthChecker>
  )
}
