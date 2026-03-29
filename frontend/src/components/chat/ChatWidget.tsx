import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'

// Lightweight markdown renderer (bold, italic, inline code, bullet lists, numbered lists, headings)
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')

  function renderInline(line: string): React.ReactNode[] {
    // Process **bold**, *italic*, `code`
    const parts: React.ReactNode[] = []
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
    let last = 0
    let match
    let key = 0
    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index))
      if (match[2]) parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>)
      else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>)
      else if (match[4]) parts.push(<code key={key++} className="bg-slate-100 text-slate-700 px-1 rounded text-xs font-mono">{match[4]}</code>)
      last = match.index + match[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    return parts
  }

  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      elements.push(<div key={i} className="h-1" />)
    } else if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,3})\s/)![1].length
      const content = trimmed.replace(/^#{1,3}\s/, '')
      const cls = level === 1 ? 'font-bold text-base mt-1' : level === 2 ? 'font-semibold text-sm mt-1' : 'font-semibold text-xs mt-1'
      elements.push(<p key={i} className={cls}>{renderInline(content)}</p>)
    } else if (/^[-*]\s/.test(trimmed)) {
      // Collect consecutive bullet lines
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-0.5 my-1">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    } else if (/^\d+\.\s/.test(trimmed)) {
      // Collect consecutive numbered lines
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-0.5 my-1">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ol>
      )
      continue
    } else {
      elements.push(<p key={i} className="my-0.5 leading-snug">{renderInline(trimmed)}</p>)
    }
    i++
  }

  return <div className="text-sm">{elements}</div>
}

interface SqlResult {
  sql: string
  rows: Record<string, unknown>[]
  row_count: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sqlResult?: SqlResult
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function getToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem('auth-storage') ?? '')?.state?.token ?? null
  } catch {
    return null
  }
}

function SqlTable({ result }: { result: SqlResult }) {
  const [expanded, setExpanded] = useState(false)
  if (!result.rows.length) return null
  const cols = Object.keys(result.rows[0])
  const displayRows = expanded ? result.rows : result.rows.slice(0, 5)

  return (
    <div className="mt-2 text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-400">{result.row_count} ta natija</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-slate-600 underline text-xs"
        >
          {expanded ? 'Yig\'ish' : 'Barchasini ko\'rish'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1 text-left text-slate-600 font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1 text-slate-700 whitespace-nowrap max-w-[120px] truncate">
                    {String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// SpeechRecognition browser API type
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export default function ChatWidget() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('Brauzeringiz ovoz tanishni qo\'llab-quvvatlamaydi. Chrome yoki Edge ishlatib ko\'ring.')
      return
    }
    const rec = new SR()
    rec.lang = 'uz-UZ'
    rec.interimResults = true
    rec.continuous = false
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      setInput(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    setListening(true)
  }

  // Only show for MFO_ADMIN and MERCHANT
  if (!user || !['MFO_ADMIN', 'MERCHANT'].includes(user.role)) return null

  const roleColor =
    user.role === 'MFO_ADMIN'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-blue-600 hover:bg-blue-700'

  const headerColor =
    user.role === 'MFO_ADMIN' ? 'bg-emerald-600' : 'bg-blue-600'

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Placeholder for assistant response
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const token = getToken()
      const res = await fetch(`${BASE}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: "Xatolik yuz berdi. Qayta urinib ko'ring.",
          }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.delta !== undefined) {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + parsed.delta,
                  // If sql_result comes with this chunk, attach it
                  ...(parsed.sql_result ? { sqlResult: parsed.sql_result } : {}),
                }
                return updated
              })
            } else if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: 'Xatolik: ' + parsed.error,
                }
                return updated
              })
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Server bilan ulanishda xatolik.',
        }
        return updated
      })
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const placeholder =
    user.role === 'MFO_ADMIN'
      ? 'Savol bering: tarif, merchant, approval rate...'
      : 'Savol bering: mahsulot, ariza, rassrochka...'

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg text-white flex items-center justify-center transition-all ${roleColor}`}
          title="AI Yordamchi"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-[420px] h-[560px] flex flex-col rounded-2xl shadow-2xl bg-white border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className={`${headerColor} text-white px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.607L5 14.5m14.8.5l-1.5 4.5M5 14.5L3.5 19" />
              </svg>
              <span className="font-semibold text-sm">AI Yordamchi</span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-white/70 hover:text-white text-xs"
                  title="Suhbatni tozalash"
                >
                  Tozalash
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 text-sm mt-8">
                <p className="text-2xl mb-2">👋</p>
                <p>Salom! Qanday yordam bera olaman?</p>
                <p className="text-xs mt-2 text-slate-400">
                  {user.role === 'MFO_ADMIN'
                    ? 'Masalan: "oxirgi 10 ta ariza", "rad etilgan arizalar ro\'yxati", "bugungi arizalar"'
                    : 'Masalan: "oxirgi arizalarim", "muddati o\'tgan to\'lovlar", "mahsulotlar ro\'yxati"'}
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-slate-700 text-white rounded-br-sm whitespace-pre-wrap'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : msg.content === '' ? (
                    <span className="inline-flex gap-1 items-center py-0.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : (
                    <MarkdownText text={msg.content} />
                  )}
                  {msg.role === 'assistant' && msg.sqlResult && (
                    <SqlTable result={msg.sqlResult} />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200 bg-white flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={streaming}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50 max-h-28 overflow-y-auto"
              style={{ height: 'auto', minHeight: '38px' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 112) + 'px'
              }}
            />
            <button
                onClick={toggleVoice}
                disabled={streaming}
                title={listening ? 'Tinglashni to\'xtatish' : 'Ovoz bilan yozish'}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 ${
                  listening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 ${
                user.role === 'MFO_ADMIN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
