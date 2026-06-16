/** Format an elapsed duration (ms) into a compact human label. Pure. */
export function formatElapsed(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '0.0s'
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
