import { relative, sep } from 'node:path'

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

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
  if (!name || /[.\s]$/.test(name) || WINDOWS_RESERVED.test(name)) {
    throw new Error(`"${name}" is not a valid name on Windows.`)
  }
}
