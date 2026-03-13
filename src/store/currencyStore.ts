import { create } from 'zustand'

type DisplayCurrency = 'USD' | 'CAD'

interface CurrencyState {
  displayCurrency: DisplayCurrency
  usdToCadRate: number | null
  setDisplayCurrency: (c: DisplayCurrency) => void
  setUsdToCadRate: (rate: number | null) => void
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  displayCurrency: 'USD',
  usdToCadRate: null,
  setDisplayCurrency: (c) => set({ displayCurrency: c }),
  setUsdToCadRate: (rate) => set({ usdToCadRate: rate }),
}))

/** Convert USD to display value (USD unchanged, CAD = USD * rate). */
export function toDisplayValue(usd: number, displayCurrency: DisplayCurrency, usdToCadRate: number | null): number {
  if (displayCurrency === 'USD') return usd
  if (usdToCadRate != null) return usd * usdToCadRate
  return usd
}

/** Convert value in native market (USD or CAD) to display currency. */
export function nativeToDisplay(
  value: number,
  nativeMarket: 'USD' | 'CAD',
  displayCurrency: DisplayCurrency,
  usdToCadRate: number | null
): number {
  if (displayCurrency === nativeMarket) return value
  if (nativeMarket === 'USD' && displayCurrency === 'CAD' && usdToCadRate != null) return value * usdToCadRate
  if (nativeMarket === 'CAD' && displayCurrency === 'USD' && usdToCadRate != null) return value / usdToCadRate
  return value
}

/** Format number as currency with correct symbol. */
export function formatDisplayCurrency(
  usd: number,
  displayCurrency: DisplayCurrency,
  usdToCadRate: number | null,
  options?: Intl.NumberFormatOptions
): string {
  const value = toDisplayValue(usd, displayCurrency, usdToCadRate)
  const symbol = displayCurrency === 'CAD' ? 'CA$' : '$'
  return symbol + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
}

/** Format a value stored in native market (USD or CAD) for display. */
export function formatNativeAsDisplay(
  value: number,
  nativeMarket: 'USD' | 'CAD',
  displayCurrency: DisplayCurrency,
  usdToCadRate: number | null,
  options?: Intl.NumberFormatOptions
): string {
  const v = nativeToDisplay(value, nativeMarket, displayCurrency, usdToCadRate)
  const symbol = displayCurrency === 'CAD' ? 'CA$' : '$'
  return symbol + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
}
