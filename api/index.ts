/**
 * Catch-all API router — single serverless function for all /api/* routes.
 * Keeps deployment under Vercel Hobby's 12-function limit.
 * Rewrites in vercel.json send /api/:path* to /api?path=:path*
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handler as auth } from './handlers/auth'
import { handler as authLogout } from './handlers/auth-logout'
import { handler as authMe } from './handlers/auth-me'
import { handler as portfolio } from './handlers/portfolio'
import { handler as portfolioId } from './handlers/portfolio-id'
import { handler as portfolioTaxLoss } from './handlers/portfolio-tax-loss'
import { handler as watchlist } from './handlers/watchlist'
import { handler as watchlistId } from './handlers/watchlist-id'
import { handler as alerts } from './handlers/alerts'
import { handler as alertsId } from './handlers/alerts-id'
import { handler as scores } from './handlers/scores'
import { handler as news } from './handlers/news'
import { handler as chat } from './handlers/chat'
import { handler as screener } from './handlers/screener'
import { handler as screenerRank } from './handlers/screener-rank'
import { handler as reportsIndex } from './handlers/reports-index'
import { handler as reportsGenerate } from './handlers/reports-generate'
import { handler as discoveryIndex } from './handlers/discovery-index'
import { handler as discoveryRun } from './handlers/discovery-run'
import { handler as marketFx } from './handlers/market-fx'
import { handler as marketWsToken } from './handlers/market-ws-token'
import { handler as marketMacro } from './handlers/market-macro'
import { handler as marketSectorRotation } from './handlers/market-sector-rotation'
import { handler as jobsPreMarket } from './handlers/jobs-pre-market'
import { handler as jobsNewsRefresh } from './handlers/jobs-news-refresh'
import { handler as jobsEodReport } from './handlers/jobs-eod-report'
import { handler as jobsEveningDigest } from './handlers/jobs-evening-digest'
import { handler as jobsOvernightPrep } from './handlers/jobs-overnight-prep'
import { handler as jobsNewsPurge } from './handlers/jobs-news-purge'
import { handler as filingsSummary } from './handlers/filings-summary'
import { handler as earningsTranscript } from './handlers/earnings-transcript'
import { handler as searchSemantic } from './handlers/search-semantic'
import { handler as embeddingsIngest } from './handlers/embeddings-ingest'
import { handler as sentimentReddit } from './handlers/sentiment-reddit'

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
  // Path from rewrite /api?path=:path* or from req.url
  let pathStr = ''
  const pathParam = req.query.path ?? req.query['path[]']
  if (pathParam) {
    const segs = Array.isArray(pathParam) ? pathParam : [pathParam]
    pathStr = segs.map(String).join('/')
  }
  if (!pathStr && typeof req.url === 'string') {
    const pathname = req.url.split('?')[0]
    const match = pathname.match(/^\/api\/?(.*)$/)
    pathStr = (match?.[1] ?? '').replace(/\/$/, '')
  }
  if (!pathStr) {
    return res.status(404).json({ error: 'Not found' })
  }
  const segments = pathStr.split('/').filter(Boolean)
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
