import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PrismGlyph } from '@/components/chat/PrismGlyph'

const RAINBOW =
  'linear-gradient(115deg, hsl(350 95% 62%), hsl(28 96% 56%), hsl(46 96% 54%), hsl(140 72% 46%), hsl(190 90% 50%), hsl(224 88% 62%), hsl(280 84% 64%))'

const HOLD = 1.7
const WIPE_DURATION = 1.3
const EASE = [0.7, 0, 0.25, 1] as const

/**
 * One-shot launch animation: the Open Prism mark sits centered, then a
 * full-screen rainbow wipes in from the top-left (curved), blankets the screen,
 * and wipes out to the bottom-right — revealing the home rendered underneath.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) onDone()
  }, [reduce, onDone])

  if (reduce) return null

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Cover with the logo — fades out once the rainbow fully blankets it */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center bg-background"
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{ delay: HOLD, duration: WIPE_DURATION, times: [0, 0.42, 0.5, 1] }}
      >
        <motion.div
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, scale: 0.86, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="h-20 w-20 drop-shadow-[0_0_36px_hsl(var(--spectral-1)/0.55)]">
            <PrismGlyph />
          </div>
          <div className="font-display text-4xl tracking-tight text-foreground">
            Open <span className="italic text-spectral">Prism</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Full-screen rainbow: wipes in from top-left, covers all, wipes out bottom-right */}
      <motion.div
        className="absolute inset-0"
        style={{ background: RAINBOW }}
        initial={{ clipPath: 'circle(0% at 6% 6%)' }}
        animate={{
          clipPath: [
            'circle(0% at 6% 6%)',
            'circle(175% at 6% 6%)',
            'circle(175% at 94% 94%)',
            'circle(0% at 94% 94%)'
          ]
        }}
        transition={{ delay: HOLD, duration: WIPE_DURATION, ease: EASE, times: [0, 0.42, 0.52, 1] }}
        onAnimationComplete={onDone}
      />
    </div>
  )
}
