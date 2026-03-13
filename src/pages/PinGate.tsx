import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { apiPost } from '../lib/api'

const PIN_LENGTH = 6

export default function PinGate() {
  const navigate = useNavigate()
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated)
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)

  const pinStr = pin.join('')

  const submitPin = useCallback(async (pinOverride?: string) => {
    const toSend = pinOverride ?? pinStr
    if (toSend.length !== PIN_LENGTH) return
    setError('')
    setLoading(true)
    try {
      const res = await apiPost<{ ok: boolean; lockedUntil?: string }>('/auth', { pin: toSend })
      if (res.ok) {
        setAuthenticated(true)
        navigate('/dashboard', { replace: true })
        return
      }
      if ((res as { lockedUntil?: string }).lockedUntil) {
        setLockedUntil((res as { lockedUntil: string }).lockedUntil)
        setError('Too many attempts. Try again later.')
      } else {
        setError('Incorrect PIN')
        setPin(Array(PIN_LENGTH).fill(''))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPin(Array(PIN_LENGTH).fill(''))
    } finally {
      setLoading(false)
    }
  }, [pinStr, setAuthenticated, navigate])

  const handleDigit = (index: number, value: string) => {
    if (lockedUntil && new Date(lockedUntil) > new Date()) return
    if (!/^\d*$/.test(value)) return
    const next = [...pin]
    next[index] = value.slice(-1)
    setPin(next)
    setError('')
    if (value && index < PIN_LENGTH - 1) {
      const input = document.getElementById(`pin-${index + 1}`)
      if (input) (input as HTMLInputElement).focus()
    }
    if (next.every((d) => d) && next.join('').length === PIN_LENGTH) {
      submitPin(next.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pinStr.length === PIN_LENGTH) {
      e.preventDefault()
      submitPin()
      return
    }
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const input = document.getElementById(`pin-${index - 1}`)
      if (input) (input as HTMLInputElement).focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (!pasted) return
    const next = pasted.split('').concat(Array(PIN_LENGTH).fill('')).slice(0, PIN_LENGTH)
    setPin(next)
    setError('')
    const lastIdx = Math.min(pasted.length, PIN_LENGTH) - 1
    const input = document.getElementById(`pin-${lastIdx}`)
    if (input) (input as HTMLInputElement).focus()
    if (next.every((d) => d)) submitPin(next.join(''))
  }

  const isLocked = lockedUntil && new Date(lockedUntil) > new Date()

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-stone-800">AlphaTerm</h1>
          <p className="mt-1 text-sm text-muted">Enter your PIN</p>
        </div>
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <input
              key={i}
              id={`pin-${i}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={pin[i]}
              disabled={isLocked || loading}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-11 h-12 text-center text-lg font-medium border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent disabled:opacity-50"
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => submitPin()}
            disabled={loading || pinStr.length !== PIN_LENGTH}
            className="px-4 py-2 rounded-md bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Checking…' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={() => setPin(Array(PIN_LENGTH).fill(''))}
            disabled={loading || pinStr.length === 0}
            className="text-sm text-muted hover:text-stone-700 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
        {isLocked && lockedUntil && (
          <p className="text-center text-xs text-muted">
            Locked until {new Date(lockedUntil).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
