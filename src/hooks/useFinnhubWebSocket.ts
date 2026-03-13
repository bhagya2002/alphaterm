import { useEffect, useRef } from 'react'
import { useMarketStore } from '../store/marketStore'
import { usePortfolioStore } from '../store/portfolioStore'

const MAX_SYMBOLS = 50
const WS_URL = 'wss://ws.finnhub.io'

/**
 * Single Finnhub WebSocket connection. Subscribes to symbols from portfolio + watchlist (cap 50).
 * Pushes price updates into market store.
 * Requires FINNHUB_API_KEY to be available from the API; client gets a token from /api/market/ws-token or we use env in build.
 * For now we use a token from the backend - the frontend will need to fetch it. Alternatively we could proxy WS.
 * Simplest: frontend calls GET /api/market/quotes?symbols=AAPL,MSFT and we poll from API (no WS on client). 
 * PRD says "Finnhub WebSocket (free: up to 50 symbols)" - so we need WS. The free tier token is typically used client-side for WS.
 * So we need VITE_FINNHUB_API_KEY or the app fetches quotes via our API that uses Finnhub REST/WS server-side.
 * Plan says "distribute price updates to all subscribed components via Zustand store" - so a single WS connection.
 * Implementing: we'll have the frontend get a token from our API (api/market/ws-token returns { token } from FINNHUB_API_KEY) so we don't expose the key. Then connect to Finnhub WS with that token.
 */
export function useFinnhubWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const setQuote = useMarketStore((s) => s.setQuote)
  const holdings = usePortfolioStore((s) => s.holdings)
  const symbols = Array.from(
    new Set([
      ...holdings.filter((h) => h.is_active).map((h) => h.ticker),
      // Watchlist symbols would come from a watchlist store or API
    ])
  ).slice(0, MAX_SYMBOLS)
  const symbolKey = symbols.join(',')

  useEffect(() => {
    if (symbols.length === 0) return

    let ws: WebSocket | null = null
    let token: string | null = null

    const connect = async () => {
      try {
        const res = await fetch('/api/market/ws-token', { credentials: 'include' })
        const data = await res.json()
        token = data.token
      } catch {
        return
      }
      if (!token) return
      const url = `${WS_URL}?token=${token}`
      ws = new WebSocket(url)
      ws.onopen = () => {
        symbols.forEach((s) => ws?.send(JSON.stringify({ type: 'subscribe', symbol: s })))
      }
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'trade' && data.data) {
            data.data.forEach((t: { s: string; p: number }) => {
              setQuote(t.s, {
                symbol: t.s,
                price: t.p,
                updatedAt: Date.now(),
              })
            })
          }
        } catch {
          // ignore parse errors
        }
      }
      ws.onerror = () => {
        // connection errors handled on close
      }
      ws.onclose = () => {
        wsRef.current = null
      }
      wsRef.current = ws
    }

    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  // symbolKey is the stable dependency; symbols is used inside connect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey, setQuote])

  return { connected: !!wsRef.current }
}
