/**
 * Pulls a short human-friendly error summary out of a Tectonic log.
 */
export function summarizeTectonicLog(log: string): string {
  const lines = log.split('\n')
  const fileLine = lines.find((l) => /^.+\.tex:\d+:/.test(l.trim()))
  if (fileLine) return fileLine.trim()
  const errLine = lines.find((l) => /\berror\b/i.test(l))
  if (errLine) return errLine.trim()
  return 'Compilation failed (see log).'
}
