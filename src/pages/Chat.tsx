import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'

interface ChatMessage {
  id?: string
  role: string
  content: string
  timestamp?: string
}

export default function Chat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    apiGet<{ messages: ChatMessage[] }>('/chat')
      .then((r) => setMessages(r.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [])

  const handleSend = () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    apiPost<{ reply: string; message_id?: string }>('/chat', { message: text })
      .then((r) => {
        setMessages((prev) => [...prev, { role: 'assistant', content: r.reply, id: r.message_id }])
      })
      .catch(() => {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
      })
      .finally(() => setSending(false))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Chat</h1>
      <p className="text-sm text-muted">
        Ask about your holdings, scores, or market. Context includes your portfolio and today’s headlines.
      </p>

      <div className="border border-border rounded-lg bg-white flex flex-col min-h-[320px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {loading ? (
            <p className="text-sm text-muted">Loading history…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted">No messages yet. Send a message below.</p>
          ) : (
            messages.map((m, i) => (
              <div
                key={m.id ?? i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-border flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask your analyst…"
            className="flex-1 border border-border rounded px-3 py-2 text-sm min-h-[44px] resize-none"
            rows={2}
            disabled={sending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded bg-stone-800 text-white text-sm hover:bg-stone-700 disabled:opacity-50"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
