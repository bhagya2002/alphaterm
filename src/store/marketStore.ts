import { create } from 'zustand'

export interface PriceQuote {
  symbol: string
  price: number
  change?: number
  changePercent?: number
  volume?: number
  updatedAt: number
}

interface MarketState {
  quotes: Record<string, PriceQuote>
  setQuote: (symbol: string, quote: PriceQuote) => void
  setQuotes: (quotes: Record<string, PriceQuote>) => void
  getQuote: (symbol: string) => PriceQuote | undefined
}

export const useMarketStore = create<MarketState>((set, get) => ({
  quotes: {},
  setQuote: (symbol, quote) =>
    set((s) => ({ quotes: { ...s.quotes, [symbol]: quote } })),
  setQuotes: (quotes) => set((s) => ({ quotes: { ...s.quotes, ...quotes } })),
  getQuote: (symbol) => get().quotes[symbol],
}))
