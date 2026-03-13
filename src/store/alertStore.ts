import { create } from 'zustand'

export interface Alert {
  id: string
  ticker: string
  alert_type: string
  message: string
  triggered_at: string
  dismissed_at: string | null
  dismissed: boolean
}

interface AlertState {
  alerts: Alert[]
  setAlerts: (alerts: Alert[]) => void
  dismissAlert: (id: string) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  dismissAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, dismissed: true, dismissed_at: new Date().toISOString() } : a
      ),
    })),
}))
