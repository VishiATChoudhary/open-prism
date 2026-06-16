import { cn } from '@/lib/utils'

/** Static prism mark — used as the assistant avatar and brand glyph. */
export function PrismGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-full w-full', className)} aria-hidden>
      <path
        d="M12 3.5 21 19.5H3L12 3.5Z"
        stroke="url(#pg-edge)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 3.5 12 19.5" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.6" />
      <defs>
        <linearGradient id="pg-edge" x1="3" y1="20" x2="21" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(350 95% 62%)" />
          <stop offset="0.16" stopColor="hsl(28 96% 56%)" />
          <stop offset="0.32" stopColor="hsl(46 96% 54%)" />
          <stop offset="0.48" stopColor="hsl(140 72% 46%)" />
          <stop offset="0.64" stopColor="hsl(190 90% 50%)" />
          <stop offset="0.8" stopColor="hsl(224 88% 62%)" />
          <stop offset="1" stopColor="hsl(280 84% 64%)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/**
 * Animated refraction loader: a white beam enters a prism and disperses into a
 * spectrum that sweeps. Pure SVG + CSS. Honors prefers-reduced-motion.
 */
export function PrismLoader({ size = 64 }: { size?: number }) {
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Thinking"
    >
      {/* dispersed spectrum fan, sweeping behind the prism */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 animate-prism-spin opacity-70"
          style={{
            background:
              'conic-gradient(from 200deg, transparent 0deg, hsl(350 95% 62% / 0.55) 12deg, hsl(28 96% 56% / 0.55) 20deg, hsl(46 96% 54% / 0.55) 28deg, hsl(140 72% 46% / 0.52) 36deg, hsl(190 90% 50% / 0.55) 44deg, hsl(224 88% 62% / 0.55) 52deg, hsl(280 84% 64% / 0.55) 60deg, transparent 76deg)',
            filter: 'blur(6px)'
          }}
        />
      </div>

      {/* incoming beam */}
      <div className="absolute left-0 top-1/2 h-px w-1/2 -translate-y-1/2 overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent to-foreground/70" />
        <div className="animate-beam-sweep absolute inset-0 bg-foreground/90" />
      </div>

      {/* the prism */}
      <svg viewBox="0 0 64 64" className="absolute inset-0">
        <path
          d="M32 12 54 50H10L32 12Z"
          fill="hsl(var(--elevated) / 0.6)"
          stroke="url(#pl-edge)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="pl-edge" x1="10" y1="52" x2="54" y2="12" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(350 95% 62%)" />
            <stop offset="0.16" stopColor="hsl(28 96% 56%)" />
            <stop offset="0.32" stopColor="hsl(46 96% 54%)" />
            <stop offset="0.48" stopColor="hsl(140 72% 46%)" />
            <stop offset="0.64" stopColor="hsl(190 90% 50%)" />
            <stop offset="0.8" stopColor="hsl(224 88% 62%)" />
            <stop offset="1" stopColor="hsl(280 84% 64%)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

/** Three spectral dots that bounce — compact inline "working" indicator. */
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-1', className)} aria-hidden>
      <span
        className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-spectral-1"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-spectral-2"
        style={{ animationDelay: '160ms' }}
      />
      <span
        className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-spectral-3"
        style={{ animationDelay: '320ms' }}
      />
    </span>
  )
}
