-- AlphaTerm Supabase schema (PRD §14)
-- Run in Supabase SQL Editor

-- pgvector for semantic search (Phase 4)
CREATE EXTENSION IF NOT EXISTS vector;

-- Portfolio holdings
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  company_name TEXT,
  exchange TEXT,
  market TEXT NOT NULL DEFAULT 'USD',
  account_type TEXT NOT NULL DEFAULT 'Personal',
  shares NUMERIC NOT NULL,
  avg_cost NUMERIC DEFAULT 0,
  date_opened DATE,
  notes TEXT,
  in_watchlist BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  company_name TEXT,
  exchange TEXT,
  market TEXT DEFAULT 'USD',
  added_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  alert_enabled BOOLEAN DEFAULT false
);

-- Stock scores
CREATE TABLE IF NOT EXISTS stock_scores (
  ticker TEXT PRIMARY KEY,
  score NUMERIC,
  recommendation TEXT,
  fundamental_score NUMERIC,
  technical_score NUMERIC,
  sentiment_score NUMERIC,
  momentum_score NUMERIC,
  esc_score NUMERIC,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- News articles (purge after 7 days)
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT,
  headline TEXT,
  source TEXT,
  url TEXT,
  sentiment_score NUMERIC,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  alert_type TEXT,
  message TEXT,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT false
);

-- Research reports
CREATE TABLE IF NOT EXISTS research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  report_json JSONB,
  ai_score NUMERIC,
  provider_used TEXT,
  model_used TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Discovery results
CREATE TABLE IF NOT EXISTS discovery_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  esc_score NUMERIC,
  esc_label TEXT,
  ai_thesis TEXT,
  signals_json JSONB,
  run_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  role TEXT NOT NULL,
  content TEXT,
  context_snapshot JSONB,
  provider_used TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Prompt templates
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  template_text TEXT,
  version INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Job logs
CREATE TABLE IF NOT EXISTS job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT,
  provider_used TEXT,
  tokens_approx INTEGER,
  error_message TEXT,
  run_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-market brief (one per day)
CREATE TABLE IF NOT EXISTS pre_market_briefs (
  brief_date DATE PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EOD report (one per day)
CREATE TABLE IF NOT EXISTS eod_reports (
  report_date DATE PRIMARY KEY,
  content TEXT NOT NULL,
  pnl_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Evening digest (after market, ~6 PM ET)
CREATE TABLE IF NOT EXISTS evening_digests (
  digest_date DATE PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Overnight brief (pre-open prep, ~2 AM ET)
CREATE TABLE IF NOT EXISTS overnight_briefs (
  brief_date DATE PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PIN brute-force lockout
CREATE TABLE IF NOT EXISTS ip_lockouts (
  ip TEXT PRIMARY KEY,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- OHLCV cache
CREATE TABLE IF NOT EXISTS ohlcv_cache (
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume NUMERIC,
  cached_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (ticker, date)
);

-- FX rates (e.g. CAD/USD from Bank of Canada Valet); TTL 24h
CREATE TABLE IF NOT EXISTS fx_rates (
  pair TEXT PRIMARY KEY,
  rate NUMERIC NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- Macro indicators cache (FRED series); TTL 1 day
CREATE TABLE IF NOT EXISTS macro_cache (
  series_id TEXT PRIMARY KEY,
  value NUMERIC,
  observation_date DATE,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- Filing summaries cache (Phase 4 – SEC/SEDAR+)
CREATE TABLE IF NOT EXISTS filing_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  filing_type TEXT,
  filing_date DATE,
  source TEXT,
  source_url TEXT,
  summary_text TEXT,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- Earnings call transcript analysis cache (Phase 4)
CREATE TABLE IF NOT EXISTS earnings_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  call_date DATE,
  source TEXT,
  source_url TEXT,
  summary_text TEXT,
  sentiment_label TEXT,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- Semantic search embeddings for reports and news (Phase 4)
CREATE TABLE IF NOT EXISTS report_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT,
  content_type TEXT NOT NULL, -- e.g. 'report' | 'news'
  content_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sector rotation cache (Phase 4)
CREATE TABLE IF NOT EXISTS sector_rotation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT current_date,
  horizon TEXT NOT NULL DEFAULT '1D', -- e.g. '1D', '1M', '3M'
  data JSONB NOT NULL,
  narrative TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Simple helper for vector similarity search over report_embeddings
CREATE OR REPLACE FUNCTION match_report_embeddings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
) RETURNS TABLE (
  id UUID,
  ticker TEXT,
  content_type TEXT,
  content_text TEXT,
  similarity float,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.ticker,
    e.content_type,
    e.content_text,
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.created_at
  FROM report_embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RLS: enable and allow service role full access; anon can be restricted per table if needed
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_market_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE eod_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE evening_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overnight_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ohlcv_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE filing_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_rotation_cache ENABLE ROW LEVEL SECURITY;

-- RLS: Service role (used by API) bypasses RLS. Anon key has no policies by default (no direct client access to DB).
