import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { unzipSync } from 'fflate'
import { assertWindowsSafeName } from './projectPaths'

export interface ZipLimits {
  /** Maximum size of the ZIP file on disk. */
  maxArchiveBytes: number
  /** Maximum uncompressed size of a single entry. */
  maxEntryBytes: number
  /** Maximum total uncompressed size of all accepted entries. */
  maxTotalBytes: number
  /** Maximum number of accepted entries. */
  maxEntries: number
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 200 * 1024 * 1024,
  maxEntryBytes: 100 * 1024 * 1024,
  maxTotalBytes: 500 * 1024 * 1024,
  maxEntries: 5000
}

const UNSAFE_PATHS = 'Zip archive contains unsafe paths.'
const ARCHIVE_TOO_LARGE = 'Zip archive is too large.'
const ENTRY_TOO_LARGE = 'Zip entry is too large.'
const TOO_MANY_ENTRIES = 'Zip archive contains too many files.'

function resolveLimits(limits: Partial<ZipLimits>): ZipLimits {
  return {
    maxArchiveBytes: limits.maxArchiveBytes ?? DEFAULT_ZIP_LIMITS.maxArchiveBytes,
    maxEntryBytes: limits.maxEntryBytes ?? DEFAULT_ZIP_LIMITS.maxEntryBytes,
    maxTotalBytes: limits.maxTotalBytes ?? DEFAULT_ZIP_LIMITS.maxTotalBytes,
    maxEntries: limits.maxEntries ?? DEFAULT_ZIP_LIMITS.maxEntries
  }
}

function isSafeZipSegment(segment: string): boolean {
  if (!segment || segment !== segment.trim() || segment === '.' || segment === '..') return false
  try {
    assertWindowsSafeName(segment)
    return true
  } catch {
    return false
  }
}

function assertSafeZipEntry(entry: string): void {
  if (
    !entry ||
    entry !== entry.trim() ||
    entry.startsWith('/') ||
    entry.includes('\\') ||
    /^[A-Za-z]:/.test(entry) ||
    !entry.split('/').every(isSafeZipSegment)
  ) {
    throw new Error(UNSAFE_PATHS)
  }
}

export function validateZipEntries(entries: string[]): void {
  for (const entry of entries) assertSafeZipEntry(entry)
}

function isMetadataEntry(name: string): boolean {
  return (
    name.endsWith('/') ||
    name === '__MACOSX' ||
    name.startsWith('__MACOSX/') ||
    name.endsWith('.DS_Store')
  )
}

/** Read a ZIP into memory, filtering metadata and rejecting oversized archives. */
export async function readZip(
  zipPath: string,
  limits: Partial<ZipLimits> = {}
): Promise<Map<string, Uint8Array>> {
  const effective = resolveLimits(limits)
  const buffer = new Uint8Array(await fs.readFile(zipPath))
  if (buffer.byteLength > effective.maxArchiveBytes) {
    throw new Error(ARCHIVE_TOO_LARGE)
  }

  let entryCount = 0
  let totalBytes = 0

  const extracted = unzipSync(buffer, {
    filter: (file) => {
      if (isMetadataEntry(file.name)) return false
      assertSafeZipEntry(file.name)

      entryCount += 1
      if (entryCount > effective.maxEntries) throw new Error(TOO_MANY_ENTRIES)
      if (file.originalSize > effective.maxEntryBytes) throw new Error(ENTRY_TOO_LARGE)

      totalBytes += file.originalSize
      if (totalBytes > effective.maxTotalBytes) throw new Error(ARCHIVE_TOO_LARGE)

      return true
    }
  })

  const files = new Map<string, Uint8Array>()
  for (const [name, data] of Object.entries(extracted)) {
    if (isMetadataEntry(name)) continue
    files.set(name, data)
  }

  return files
}

/** Extract a validated ZIP into targetDir and return the written entry names. */
export async function extractZip(
  zipPath: string,
  targetDir: string,
  limits: Partial<ZipLimits> = {}
): Promise<string[]> {
  const files = await readZip(zipPath, limits)

  for (const [name, data] of files) {
    const destination = join(targetDir, ...name.split('/'))
    await fs.mkdir(dirname(destination), { recursive: true })
    await fs.writeFile(destination, data)
  }

  return [...files.keys()]
}
