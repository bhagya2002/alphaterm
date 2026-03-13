import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth } from '../lib/verifyAuth'
import { supabase } from '../lib/supabase'
import { runInference } from '../lib/inferenceRouter'

interface FilingSummaryRow {
  id?: string
  ticker: string
  filing_type: string | null
  filing_date: string | null
  source: string | null
  source_url: string | null
  summary_text: string | null
  cached_at?: string
}

interface EdgarEntry {
  filingType: string
  filingDate: string
  title: string
  summary: string
  link: string
}

const MAX_FILINGS = 3

function parseEdgarAtom(xml: string): EdgarEntry[] {
  const entries: EdgarEntry[] = []
  const parts = xml.split('<entry>').slice(1)
  for (const part of parts) {
    const chunk = part.split('</entry>')[0] ?? ''
    const getTag = (tag: string) => {
      const m = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
      return m ? m[1].trim() : ''
    }
    const title = getTag('title')
    const updated = getTag('updated')
    const summary = getTag('summary')
    const categoryMatch = chunk.match(/<category[^>]*term="([^"]+)"[^>]*>/i)
    const filingType = categoryMatch ? categoryMatch[1].trim() : ''
    const linkMatch = chunk.match(/<link[^>]*href="([^"]+)"[^>]*>/i)
    const link = linkMatch ? linkMatch[1].trim() : ''
    if (!title) continue
    entries.push({
      filingType: filingType || title.split('-')[0]?.trim() || 'FILING',
      filingDate: updated ? updated.slice(0, 10) : '',
      title,
      summary,
      link,
    })
  }
  return entries
}

async function fetchEdgarFilings(ticker: string): Promise<EdgarEntry[] | null> {
  const ua = process.env.SEC_USER_AGENT || 'alphaterm/phase4 (contact: example@example.com)'
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
    ticker
  )}&type=10-&owner=include&count=10&output=atom`
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      Accept: 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  })
  if (!res.ok) return null
  const xml = await res.text()
  return parseEdgarAtom(xml)
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await verifyAuth(req, res)
  if (!ok) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tickerParam =
    (req.method === 'GET' ? (req.query.ticker as string) : (req.body as any)?.ticker) || ''
  const ticker = tickerParam.toUpperCase().trim()
  if (!ticker) {
    return res.status(400).json({ error: 'ticker required' })
  }

  // First, check cache
  const { data: cached, error: cacheError } = await supabase
    .from<FilingSummaryRow>('filing_summaries')
    .select('*')
    .eq('ticker', ticker)
    .order('filing_date', { ascending: false })
    .limit(MAX_FILINGS)

  if (cacheError) {
    return res.status(500).json({ error: cacheError.message })
  }

  if (cached && cached.length > 0) {
    return res.status(200).json({ summaries: cached, source: 'cache' })
  }

  // For now, support only US tickers via SEC. SEDAR+ is stubbed.
  const isCanadian = ticker.endsWith('.TO') || ticker.endsWith('.CN')
  if (isCanadian) {
    return res.status(200).json({
      summaries: [],
      source: 'stub',
      message: 'SEDAR+ filings integration coming soon for Canadian tickers.',
    })
  }

  const entries = await fetchEdgarFilings(ticker).catch(() => null)
  if (!entries || entries.length === 0) {
    return res.status(200).json({
      summaries: [],
      source: 'edgar',
      message: 'No recent SEC filings found or EDGAR feed unavailable.',
    })
  }

  const top = entries.slice(0, MAX_FILINGS)

  const baseText = top
    .map(
      (e) =>
        `${e.filingType} filed ${e.filingDate || ''}\nTitle: ${e.title}\nSummary snippet: ${
          e.summary || '(no summary)'
        }`
    )
    .join('\n\n')

  const systemPrompt =
    'You are an equity analyst summarizing recent SEC filings (10-K, 10-Q, 8-K). ' +
    'Write a concise 1–2 paragraph summary in plain language, focusing on what matters for an individual investor. ' +
    'Highlight major changes, risks, and guidance if mentioned.'

  const { text: overallSummary } = await runInference({
    taskType: 'stock_analysis_full',
    prompt: baseText,
    systemPrompt,
    contextData: { ticker, source: 'sec-edgar' },
  })

  const rows: FilingSummaryRow[] = top.map((e) => ({
    ticker,
    filing_type: e.filingType,
    filing_date: e.filingDate || null,
    source: 'sec-edgar',
    source_url: e.link || null,
    summary_text: overallSummary,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from<FilingSummaryRow>('filing_summaries')
    .insert(rows)
    .select('*')

  if (insertError) {
    // Still return LLM summary even if cache insert fails
    return res.status(200).json({
      summaries: rows,
      source: 'sec-edgar',
      warning: insertError.message,
    })
  }

  return res.status(200).json({ summaries: inserted ?? rows, source: 'sec-edgar' })
}

