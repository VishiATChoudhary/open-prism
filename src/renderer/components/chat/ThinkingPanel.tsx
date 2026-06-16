import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { formatElapsed } from '@shared/format'
import { PrismLoader, ThinkingDots } from './PrismGlyph'
import { ReasoningLog } from './ReasoningLog'

/** Mounted in the assistant slot while the CLI streams. Loader + live log. */
export function ThinkingPanel({ streaming }: { streaming: string }) {
  const startRef = useRef<number>(performance.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(performance.now() - startRef.current)
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border/80 bg-elevated/60 p-3.5 shadow-float"
    >
      <div className="flex items-center gap-3">
        <PrismLoader size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] italic text-foreground/90">Refracting…</span>
            <ThinkingDots />
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
            {formatElapsed(elapsed)} elapsed
          </div>
        </div>
      </div>

      {streaming ? (
        <ReasoningLog text={streaming} live />
      ) : (
        <div className="mt-3 h-9 overflow-hidden rounded-md border border-border/60 bg-background/50">
          <div className="relative h-full w-full">
            <div className="animate-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
          </div>
        </div>
      )}
    </motion.div>
  )
}
