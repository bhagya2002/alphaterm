/**
 * Catch-all API router — single serverless function for all /api/* routes.
 * Keeps deployment under Vercel Hobby's 12-function limit.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handler as auth } from '../api-handlers/auth'
import { handler as authLogout } from '../api-handlers/auth-logout'
import { handler as authMe } from '../api-handlers/auth-me'
import { handler as portfolio } from '../api-handlers/portfolio'
import { handler as portfolioId } from '../api-handlers/portfolio-id'
import { handler as portfolioTaxLoss } from '../api-handlers/portfolio-tax-loss'
import { handler as watchlist } from '../api-handlers/watchlist'
import { handler as watchlistId } from '../api-handlers/watchlist-id'
import { handler as alerts } from '../api-handlers/alerts'
import { handler as alertsId } from '../api-handlers/alerts-id'
import { handler as scores } from '../api-handlers/scores'
import { handler as news } from '../api-handlers/news'
import { handler as chat } from '../api-handlers/chat'
import { handler as screener } from '../api-handlers/screener'
import { handler as screenerRank } from '../api-handlers/screener-rank'
import { handler as reportsIndex } from '../api-handlers/reports-index'
import { handler as reportsGenerate } from '../api-handlers/reports-generate'
import { handler as discoveryIndex } from '../api-handlers/discovery-index'
import { handler as discoveryRun } from '../api-handlers/discovery-run'
import { handler as marketFx } from '../api-handlers/market-fx'
import { handler as marketWsToken } from '../api-handlers/market-ws-token'
import { handler as marketMacro } from '../api-handlers/market-macro'
import { handler as marketSectorRotation } from '../api-handlers/market-sector-rotation'
import { handler as jobsPreMarket } from '../api-handlers/jobs-pre-market'
import { handler as jobsNewsRefresh } from '../api-handlers/jobs-news-refresh'
import { handler as jobsEodReport } from '../api-handlers/jobs-eod-report'
import { handler as jobsEveningDigest } from '../api-handlers/jobs-evening-digest'
import { handler as jobsOvernightPrep } from '../api-handlers/jobs-overnight-prep'
import { handler as jobsNewsPurge } from '../api-handlers/jobs-news-purge'
import { handler as filingsSummary } from '../api-handlers/filings-summary'
import { handler as earningsTranscript } from '../api-handlers/earnings-transcript'
import { handler as searchSemantic } from '../api-handlers/search-semantic'
import { handler as embeddingsIngest } from '../api-handlers/embeddings-ingest'
import { handler as sentimentReddit } from '../api-handlers/sentiment-reddit'

export const config = { maxDuration: 60 }

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>

const ROUTES: Array<{ path: string | RegExp; method?: string; handler: Handler }> = [
  { path: 'auth', method: 'POST', handler: auth },
  { path: 'auth/logout', handler: authLogout },
  { path: 'auth/me', method: 'GET', handler: authMe },
  { path: 'portfolio', handler: portfolio },
  { path: 'portfolio/tax-loss', method: 'GET', handler: portfolioTaxLoss },
  { path: /^portfolio\/[^/]+$/, handler: portfolioId },
  { path: 'watchlist', handler: watchlist },
  { path: /^watchlist\/[^/]+$/, handler: watchlistId },
  { path: 'alerts', method: 'GET', handler: alerts },
  { path: /^alerts\/[^/]+$/, handler: alertsId },
  { path: 'scores', method: 'GET', handler: scores },
  { path: 'news', method: 'GET', handler: news },
  { path: 'chat', handler: chat },
  { path: 'screener', method: 'GET', handler: screener },
  { path: 'screener/rank', method: 'POST', handler: screenerRank },
  { path: 'reports', method: 'GET', handler: reportsIndex },
  { path: 'reports/generate', method: 'POST', handler: reportsGenerate },
  { path: 'discovery', method: 'GET', handler: discoveryIndex },
  { path: 'discovery/run', handler: discoveryRun },
  { path: 'market/fx', method: 'GET', handler: marketFx },
  { path: 'market/ws-token', method: 'GET', handler: marketWsToken },
  { path: 'market/macro', method: 'GET', handler: marketMacro },
  { path: 'market/sector-rotation', method: 'GET', handler: marketSectorRotation },
  { path: 'jobs/pre-market', handler: jobsPreMarket },
  { path: 'jobs/news-refresh', handler: jobsNewsRefresh },
  { path: 'jobs/eod-report', handler: jobsEodReport },
  { path: 'jobs/evening-digest', handler: jobsEveningDigest },
  { path: 'jobs/overnight-prep', handler: jobsOvernightPrep },
  { path: 'jobs/news-purge', handler: jobsNewsPurge },
  { path: 'filings/summary', handler: filingsSummary },
  { path: 'earnings/transcript', handler: earningsTranscript },
  { path: 'search/semantic', method: 'GET', handler: searchSemantic },
  { path: 'embeddings/ingest', method: 'POST', handler: embeddingsIngest },
  { path: 'sentiment/reddit', method: 'GET', handler: sentimentReddit },
]

function matchRoute(pathStr: string, method: string): Handler | null {
  for (const r of ROUTES) {
    if (r.method && r.method !== method) continue
    if (typeof r.path === 'string') {
      if (r.path === pathStr) return r.handler
    } else if (r.path.test(pathStr)) {
      return r.handler
    }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParam = req.query.path ?? req.query['path[]']
  const segments = Array.isArray(pathParam) ? pathParam : pathParam ? [pathParam] : []
  const pathStr = segments.map(String).join('/')
  if (!pathStr) {
    return res.status(404).json({ error: 'Not found' })
  }
  // Inject dynamic id for routes like portfolio/xxx, watchlist/xxx, alerts/xxx
  const lastSegment = segments[segments.length - 1]
  if (lastSegment && !['tax-loss', 'generate', 'run', 'ws-token', 'sector-rotation', 'pre-market', 'news-refresh', 'eod-report', 'evening-digest', 'overnight-prep', 'news-purge'].includes(String(lastSegment))) {
    if (segments[0] === 'portfolio' && segments.length === 2) {
      (req.query as Record<string, string>).id = String(lastSegment)
    } else if (segments[0] === 'watchlist' && segments.length === 2) {
      (req.query as Record<string, string>).id = String(lastSegment)
    } else if (segments[0] === 'alerts' && segments.length === 2) {
      (req.query as Record<string, string>).id = String(lastSegment)
    }
  }
  const routeHandler = matchRoute(pathStr, req.method || 'GET')
  if (!routeHandler) {
    return res.status(404).json({ error: 'Not found' })
  }
  return routeHandler(req, res) as Promise<void>
}
