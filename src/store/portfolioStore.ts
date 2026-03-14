import { create } from 'zustand'

export type AccountType = 'TFSA' | 'FHSA' | 'RRSP' | 'Personal'
export type Market = 'CAD' | 'USD'

export interface Holding {
  id: string
  ticker: string
  company_name: string
  exchange: string
  market: Market
  account_type: AccountType
  shares: number
  avg_cost: number
  target_sell_price?: number | null
  date_opened: string
  notes: string
  in_watchlist: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface PortfolioState {
  holdings: Holding[]
  setHoldings: (holdings: Holding[]) => void
  addHolding: (h: Omit<Holding, 'id' | 'created_at' | 'updated_at'>) => void
  updateHolding: (id: string, patch: Partial<Holding>) => void
  removeHolding: (id: string) => void
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  holdings: [],
  setHoldings: (holdings) => set({ holdings }),
  addHolding: (h) =>
    set((s) => ({
      holdings: [
        ...s.holdings,
        { ...h, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
    })),
  updateHolding: (id, patch) =>
    set((s) => ({
      holdings: s.holdings.map((x) =>
        x.id === id ? { ...x, ...patch, updated_at: new Date().toISOString() } : x
      ),
    })),
  removeHolding: (id) => set((s) => ({ holdings: s.holdings.filter((x) => x.id !== id) })),
}))
