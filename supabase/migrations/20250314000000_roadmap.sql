-- AlphaTerm Roadmap: transactions, accounts, preferences, recommendations, news summaries, target sell

-- Add summary column to news_articles
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS summary TEXT;

-- Target sell price per holding (user's target, AI considers but can recommend sell above/below with reasoning)
ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS target_sell_price NUMERIC;

-- User preferences (risk, sector prefs - single row per user for now)
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT 'default',
  risk_tolerance TEXT DEFAULT 'moderate' CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  sector_preferences TEXT[],
  target_allocation_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Accounts (brokerage, cash balances)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'Personal' CHECK (account_type IN ('TFSA', 'FHSA', 'RRSP', 'Personal')),
  cash_balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Link holdings to accounts (optional)
ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- Portfolio transactions (buy/sell history)
CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID NOT NULL REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  shares NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  transacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_holding ON portfolio_transactions(holding_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_transacted ON portfolio_transactions(transacted_at);

-- AI recommendations (cron-generated buy/sell suggestions)
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'hold', 'add', 'reduce')),
  shares_suggested NUMERIC,
  reasoning TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_run_at ON ai_recommendations(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_ticker ON ai_recommendations(ticker);

-- research_source on research_reports: portfolio | watchlist | emerging
ALTER TABLE research_reports ADD COLUMN IF NOT EXISTS research_source TEXT;

-- RLS for new tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
