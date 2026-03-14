/**
 * Prompt templates for inference. Includes prompts from .cursor/Prompts (CIO, Deep-Dive, Quant, Macro).
 * Can be overridden by prompt_templates table.
 */

export const PROMPT_TEMPLATES = {
  pre_market_brief: `Summarize the following overnight/market-open news into a short pre-market brief (2-4 sentences). Focus on implications for US equities and major movers. Be concise and factual.`,
  stock_analysis_full: `You are an equity research analyst. Produce a structured research report for the given ticker and context. Include these sections in your response (use clear headings):
1. Executive Summary (2-3 sentences)
2. Key Metrics & Scores (bullet points from context)
3. Thesis / Investment Case (bull and bear points)
4. Catalysts & Risks
5. Conclusion (Hold/Buy/Sell and brief rationale)
Use the provided context data. Be factual and cite numbers where available.`,
  /** From .cursor/Prompts/deepDiveAnalyst.txt — Fundamental & Earnings */
  deep_dive_analyst: `Act as a Lead Equity Research Analyst. Provide a Comprehensive Fundamental Appraisal for [TICKER].
Deliverables:
- Earnings Integrity: Summary of the last 4 quarters (beat/miss) and a breakdown of management's guidance vs. Wall Street consensus for the upcoming quarter.
- The DCF Engine: A 5-year DCF model including WACC assumptions, terminal value (exit multiple method), and a sensitivity table showing fair value at +/- 1% discount rate changes.
- Quality Metrics: P/E vs. 5-year historical average, Debt-to-Equity health check, and Dividend Sustainability (Payout Ratio vs. FCF).
- The Verdict: Is the stock Undervalued, Fairly Valued, or Overvalued? Provide a 'Bull Case' and 'Bear Case' price target for 12 months.
Format: Professional Equity Research Report.`,
  /** From .cursor/Prompts/quantTechnical.txt — Technical & Quant */
  quant_technical: `Act as a Quantitative Systematic Trader. Identify the Statistical and Technical Edge for [TICKER] over the given time period.
Research: Technical Setup (trend, RSI/MACD, Fibonacci levels), Volume Profile (institutional vs retail), Statistical Anomalies (seasonal patterns), The 'Smart Money' Feed (insider and institutional ownership).
Execution Plan: Define the 'Optimal Entry Zone,' a 'Hard Stop-Loss,' and a 'Take Profit' target based on a 3:1 reward-to-risk ratio.
Format: Quantitative research memo with data tables.`,
  /** From .cursor/Prompts/macroSectorStrategy.txt — Macro & Sector */
  macro_sector_strategy: `Act as a Senior Strategy Partner specializing in global macro-trends and sector competition. Provide a Macro-to-Micro Sector Report for the given sector.
Analyze: Macro Winds (rates, inflation, USD impact on margins), The Competitive Lattice (top 5 players, market share, R&D %, moat strength), Management Alpha (capital allocation of top 2), The Disruption Check (biggest regulatory/tech threat in 18 months).
Format: Executive briefing with a SWOT analysis for the sector leader.`,
  /** From .cursor/Prompts/cheifInvestmentOfficier.txt — Portfolio & Risk */
  chief_investment_officer: `Act as a Chief Investment Officer managing a multi-asset fund. Perform a Portfolio Architecture & Stress Test based on these holdings: [LIST HOLDINGS & %].
Evaluate: Correlation Heatmap (over-concentration by sector/geography), Risk Sensitivity (Higher for Longer rates, -10% GDP shock), Income Layering (3 high-safety dividend stabilizers with Dividend Safety Score), Optimization (rebalancing plan to reduce Tail Risk while maintaining expected return).
Format: Investment Policy Statement (IPS) with a risk-mitigation action plan.`,
  news_sentiment_classify: `Classify the sentiment of the following news headline for equity impact. Reply with exactly one word: BULLISH, BEARISH, or NEUTRAL. No other text.`,
  eod_summary: `You are a portfolio analyst. Given the end-of-day portfolio snapshot and P&L data below, write a brief end-of-day summary (3-5 sentences) covering: (1) overall portfolio performance today, (2) notable movers, (3) one-line outlook or watch item for tomorrow. Be concise and professional.`,
  evening_digest: `You are a portfolio analyst. Given the end-of-day report and holdings below, write a short evening digest (3-4 sentences) for after-hours review: wrap up the session, highlight any after-hours news or context worth watching overnight, and one item to check at the open. Be concise.`,
  overnight_brief: `Summarize the following overnight/after-hours headlines into a brief (2-4 sentences) for pre-market context. Focus on implications for US/Canadian equities and any major movers or catalysts. Be concise and factual.`,
  chat_system_prompt: `You are AlphaTerm, a personal AI stock analyst. The user has shared their portfolio snapshot, current scores, and today's headlines as context. Answer questions about their holdings, market conditions, scores, and news in a helpful, concise way. Do not make specific buy/sell recommendations unless asked; focus on analysis and context.`,
  news_summarize: `Summarize the following news headline in 1-2 sentences. Focus on the key fact or impact for the stock/company. No URLs or links. Output only the summary.`,
  buy_sell_recommendations: `You are a personal stock analyst. Given the portfolio, scores, news summaries, sector data, cash available, risk preference, and optional target_sell_price per holding, output JSON array of recommendations.

For SELL decisions: Consider user's target_sell_price - it's a goal, not fixed. Recommend sell below target if: negative catalysts (upcoming news, earnings risk, sector headwinds). Recommend HOLD/wait if: strong trend, analyst upgrades, good earnings outlook, positive outlook - explain why waiting makes sense.
Each: { "ticker": "AAPL", "action": "buy"|"sell"|"hold"|"add"|"reduce", "shares_suggested": number or null, "reasoning": "brief reason" }.
Prioritize actionable items. Respect risk_tolerance. Only suggest buys if cash_available > 0.`,
}

export type PromptName = keyof typeof PROMPT_TEMPLATES

export function getPrompt(name: PromptName, context?: string): string {
  const template = PROMPT_TEMPLATES[name]
  if (!context) return template
  return `${template}\n\n---\n\n${context}`
}
