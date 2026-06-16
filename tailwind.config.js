/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        elevated: 'hsl(var(--elevated))',
        foreground: 'hsl(var(--foreground))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        spectral: {
          1: 'hsl(var(--spectral-1))',
          2: 'hsl(var(--spectral-2))',
          3: 'hsl(var(--spectral-3))',
          4: 'hsl(var(--spectral-4))'
        }
      },
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        display: ['Spectral', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        float: '0 1px 0 0 hsl(0 0% 100% / 0.04) inset, 0 18px 40px -24px hsl(0 0% 0% / 0.9)',
        glow: '0 0 28px -8px hsl(var(--spectral-1) / 0.5)'
      },
      keyframes: {
        'spectral-pan': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' }
        },
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' }
        },
        'prism-spin': {
          '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
          '100%': { transform: 'translate(-50%, -50%) rotate(360deg)' }
        },
        'beam-sweep': {
          '0%': { transform: 'translateX(-100%) skewX(-12deg)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateX(220%) skewX(-12deg)', opacity: '0' }
        },
        caret: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-3px)', opacity: '1' }
        }
      },
      animation: {
        'spectral-pan': 'spectral-pan 6s linear infinite',
        'fade-rise': 'fade-rise 0.4s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
        'prism-spin': 'prism-spin 8s linear infinite',
        'beam-sweep': 'beam-sweep 2.4s ease-in-out infinite',
        caret: 'caret 1s step-end infinite',
        'dot-bounce': 'dot-bounce 1.2s ease-in-out infinite'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
