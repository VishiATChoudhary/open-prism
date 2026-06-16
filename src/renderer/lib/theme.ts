import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'open-prism-theme'
const listeners = new Set<() => void>()

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

let current: Theme = storedTheme() ?? systemTheme()

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

// Apply immediately on module load (before first paint) to avoid a flash.
apply(current)

export function setTheme(theme: Theme) {
  if (theme === current) return
  current = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
  apply(theme)
  listeners.forEach((l) => l())
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark')
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current
  )
}
