import { motion } from 'framer-motion'
import { PrismGlyph } from './PrismGlyph'

const EXAMPLES = [
  'Draft a two-column IEEE conference paper skeleton.',
  'Add a theorem environment and prove it.',
  'Insert a TikZ diagram of a feedback control loop.'
]

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, rotate: -6 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="h-10 w-10 drop-shadow-[0_0_18px_hsl(var(--spectral-1)/0.45)]"
      >
        <PrismGlyph />
      </motion.div>
      <h2 className="mt-4 font-display text-lg italic text-foreground/90">
        Describe it. <span className="text-spectral">Watch it refract.</span>
      </h2>
      <p className="mt-1 max-w-[260px] text-[12.5px] leading-relaxed text-muted-foreground">
        The assistant writes and edits your LaTeX source. Compile when you're ready.
      </p>
      <div className="mt-5 flex w-full max-w-[300px] flex-col gap-1.5">
        {EXAMPLES.map((ex, i) => (
          <motion.button
            key={ex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onPick(ex)}
            className="rounded-lg border border-border/70 bg-elevated/40 px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:border-spectral-1/30 hover:text-foreground"
          >
            {ex}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
