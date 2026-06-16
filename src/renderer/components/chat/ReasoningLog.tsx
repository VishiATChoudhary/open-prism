import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReasoningLogProps {
  text: string
  /** Live streaming view (always open, caret, auto-scroll) vs. collapsed history. */
  live?: boolean
}

/**
 * Renders the raw streamed CLI output as a terminal-style reasoning log.
 * `live` = the model is currently generating; otherwise a collapsible disclosure.
 */
export function ReasoningLog({ text, live = false }: ReasoningLogProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (live && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [text, live])

  if (live) {
    return (
      <div className="relative mt-3 overflow-hidden rounded-md border border-border/70 bg-background/60">
        {/* top fade mask */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background/80 to-transparent" />
        <div
          ref={bodyRef}
          className="max-h-40 overflow-y-auto px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground"
        >
          <span className="whitespace-pre-wrap break-words">{text}</span>
          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-caret bg-spectral-3" />
        </div>
      </div>
    )
  }

  if (!text.trim()) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-90')}
        />
        {open ? 'Hide reasoning' : 'Show reasoning'}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border/70 bg-background/50 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
              <span className="whitespace-pre-wrap break-words">{text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
