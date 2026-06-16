import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Provider } from '@shared/types'
import { useProject } from '@/state/useProject'
import { useChatSend } from '@/state/useChatSend'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { EmptyState } from '@/components/chat/EmptyState'
import { ThinkingPanel } from '@/components/chat/ThinkingPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PROVIDERS: { value: Provider; label: string; cli: string; disabled?: boolean }[] = [
  { value: 'claude', label: 'Claude', cli: 'claude CLI' },
  { value: 'chatgpt', label: 'ChatGPT', cli: 'coming soon', disabled: true }
]

export function ChatPane() {
  const { chat, settings, chatting, streaming } = useProject()
  const setSettings = useProject((s) => s.setSettings)
  const { send } = useChatSend()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  function pickProvider(provider: Provider) {
    const next = { ...settings, provider }
    setSettings(next)
    void window.api.setSettings(next)
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat, streaming, chatting])

  function submit() {
    const message = input.trim()
    if (!message || chatting) return
    setInput('')
    void send(message)
  }

  const isEmpty = chat.length === 0 && !chatting

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface/40">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3.5 py-2">
        <span className="font-display text-[13px] italic text-foreground/80">Assistant</span>
        <span className="h-1 w-1 rounded-full bg-spectral-2/60" />
        <Select value={settings.provider} onValueChange={(v) => pickProvider(v as Provider)}>
          <SelectTrigger className="h-6 w-auto gap-1 border-border/60 bg-transparent px-2 py-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:border-spectral-1/40 hover:text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem
                key={p.value}
                value={p.value}
                disabled={p.disabled}
                className="text-[12px]"
              >
                {p.label}
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/60">{p.cli}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isEmpty ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyState onPick={setInput} />
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-4">
          {chat.map((m, i) => (
            <ChatMessage key={i} message={m} />
          ))}
          <AnimatePresence>{chatting && <ThinkingPanel streaming={streaming} />}</AnimatePresence>
        </div>
      )}

      <ChatInput value={input} onChange={setInput} onSend={submit} busy={chatting} />
    </div>
  )
}
