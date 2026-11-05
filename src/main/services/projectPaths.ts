import { relative, sep } from 'node:path'

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const WINDOWS_FORBIDDEN_CHARS = '<>:"|?*'

function hasForbiddenWindowsChars(name: string): boolean {
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f) return true
    if (WINDOWS_FORBIDDEN_CHARS.includes(char)) return true
  }
  return false
}

/** Store project entries with `/` so projects are portable across operating systems. */
export function toPosixRelative(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join('/')
}

/** Normalize legacy Windows separators read from `.prism.json`. */
export function normalizeEntryPath(entry: string): string {
  return entry.replace(/\\/g, '/')
}

/** Reject names Windows cannot represent reliably. */
export function assertWindowsSafeName(name: string): void {
  if (
    !name ||
    /[.\s]$/.test(name) ||
    hasForbiddenWindowsChars(name) ||
    WINDOWS_RESERVED.test(name)
  ) {
    throw new Error(`"${name}" is not a valid name on Windows.`)
  }
}

/** True when `segment` is a single, safe path segment on Windows. */
function isWindowsSafeSegment(segment: string): boolean {
  if (!segment || segment !== segment.trim() || segment === '.' || segment === '..') return false
  try {
    assertWindowsSafeName(segment)
    return true
  } catch {
    return false
  }
}

/**
 * Normalize the project entry read from `.prism.json`.
 *
 * Anything that could escape the project directory (absolute paths, drive
 * letters, `.`/`..`/empty segments) or that Windows cannot represent reliably
 * falls back to `main.tex`.
 */
export function normalizeProjectEntry(entry: unknown): string {
  if (typeof entry !== 'string') return 'main.tex'

  const normalized = entry.trim().replace(/\\/g, '/')
  if (!normalized) return 'main.tex'
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return 'main.tex'

  const segments = normalized.split('/')
  if (!segments.every(isWindowsSafeSegment)) return 'main.tex'

  return normalized
}
