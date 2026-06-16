import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Loader2 } from 'lucide-react'

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  busy: boolean
}

export function ChatInput({ value, onChange, onSend, busy }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // auto-grow up to a cap
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [value])

  return (
    <div className="shrink-0 px-3 pb-3 pt-1">
      <div className="group relative rounded-2xl border border-border/80 bg-elevated/80 shadow-float transition-colors focus-within:border-spectral-1/40 focus-within:ring-spectral">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          rows={1}
          placeholder="Describe the document or change you want…"
          className="block max-h-[168px] w-full resize-none bg-transparent px-3.5 py-3 pr-12 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <div className="absolute bottom-2 right-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onSend}
            disabled={!busy && !value.trim()}
            className={
              busy
                ? 'flex h-8 w-8 items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground'
                : 'flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30'
            }
            aria-label={busy ? 'Streaming' : 'Send'}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </motion.button>
        </div>
      </div>
      <div className="mt-1.5 px-1 text-right font-mono text-[10px] text-muted-foreground/50">
        <kbd className="rounded bg-muted px-1 py-0.5">↵</kbd> send ·{' '}
        <kbd className="rounded bg-muted px-1 py-0.5">⇧↵</kbd> newline
      </div>
    </div>
  )
}
