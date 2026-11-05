import { promises as fs } from 'fs'
import { dirname, join, posix } from 'path'
import { unzipSync } from 'fflate'

/** Reject absolute paths, drive letters, backslashes, and any `..` segment. */
export function validateZipEntries(entries: string[]): void {
  for (const entry of entries) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    if (
      trimmed.startsWith('/') ||
      trimmed.includes('\\') ||
      /^[A-Za-z]:/.test(trimmed) ||
      trimmed.split('/').includes('..') ||
      posix.normalize(trimmed).startsWith('../') ||
      posix.normalize(trimmed) === '..' ||
      posix.normalize(trimmed).includes('/../')
    ) {
      throw new Error('Zip archive contains unsafe paths.')
    }
  }
}

function isMetadataEntry(name: string): boolean {
  return (
    name.endsWith('/') ||
    name === '__MACOSX' ||
    name.startsWith('__MACOSX/') ||
    name.endsWith('.DS_Store')
  )
}

/** Read a ZIP into memory, filtering macOS metadata and validating paths. */
export async function readZip(zipPath: string): Promise<Map<string, Uint8Array>> {
  const buffer = new Uint8Array(await fs.readFile(zipPath))
  const extracted = unzipSync(buffer)
  const files = new Map<string, Uint8Array>()

  for (const [name, data] of Object.entries(extracted)) {
    if (isMetadataEntry(name)) continue
    files.set(name, data)
  }

  validateZipEntries([...files.keys()])
  return files
}

/** Extract a validated ZIP into targetDir and return the written entry names. */
export async function extractZip(zipPath: string, targetDir: string): Promise<string[]> {
  const files = await readZip(zipPath)

  for (const [name, data] of files) {
    const destination = join(targetDir, ...name.split('/'))
    await fs.mkdir(dirname(destination), { recursive: true })
    await fs.writeFile(destination, data)
  }

  return [...files.keys()]
}
