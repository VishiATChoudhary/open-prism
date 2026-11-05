import { promises as fsPromises } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ZIP_LIMITS,
  extractZip,
  readZip,
  validateZipEntries
} from '../src/main/services/zip'

const cleanup: string[] = []

async function makeZip(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'open-prism-zip-'))
  cleanup.push(dir)
  const zipPath = join(dir, 'fixture.zip')
  const payload = Object.fromEntries(
    Object.entries(files).map(([name, body]) => [name, strToU8(body)])
  )
  await writeFile(zipPath, zipSync(payload))
  return zipPath
}

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  cleanup.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('zip import', () => {
  it('reads nested entries and skips macOS metadata', async () => {
    const zipPath = await makeZip({
      'paper/main.tex': 'hello',
      'paper/assets/figure.txt': 'asset',
      '__MACOSX/._main.tex': 'junk',
      'paper/.DS_Store': 'junk'
    })

    const files = await readZip(zipPath)

    expect([...files.keys()].sort()).toEqual(['paper/assets/figure.txt', 'paper/main.tex'])
  })

  it('extracts files into the target directory', async () => {
    const zipPath = await makeZip({ 'paper/main.tex': 'hello' })
    const target = await makeTempDir('open-prism-unzip-')

    await extractZip(zipPath, target)

    expect(await readFile(join(target, 'paper', 'main.tex'), 'utf8')).toBe('hello')
  })

  it('rejects unsafe entries', () => {
    expect(() => validateZipEntries(['../escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['/tmp/escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['paper\\escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['C:/escape.tex'])).toThrow('unsafe')
  })

  it('rejects whitespace, empty segments, and Windows-invalid segment names', () => {
    expect(() => validateZipEntries(['.. /evil.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['foo:bar'])).toThrow('unsafe')
    expect(() => validateZipEntries(['CON.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['name.tex '])).toThrow('unsafe')
    expect(() => validateZipEntries(['paper//main.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries([' paper/main.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['paper/./main.tex'])).toThrow('unsafe')
  })
})

describe('zip import limits', () => {
  it('exposes documented default limits', () => {
    expect(DEFAULT_ZIP_LIMITS).toEqual({
      maxArchiveBytes: 200 * 1024 * 1024,
      maxEntryBytes: 100 * 1024 * 1024,
      maxTotalBytes: 500 * 1024 * 1024,
      maxEntries: 5000
    })
  })

  it('rejects archives over the compressed size limit', async () => {
    const zipPath = await makeZip({ 'main.tex': 'hello' })

    await expect(readZip(zipPath, { maxArchiveBytes: 1 })).rejects.toThrow(
      'Zip archive is too large.'
    )
  })

  it('rejects archives over a low compressed size limit before reading them', async () => {
    const zipPath = await makeZip({ 'main.tex': 'hello' })
    const readSpy = vi.spyOn(fsPromises, 'readFile')

    await expect(readZip(zipPath, { maxArchiveBytes: 16 })).rejects.toThrow(
      'Zip archive is too large.'
    )

    expect(readSpy).not.toHaveBeenCalled()
  })

  it('rejects entries over the uncompressed entry limit', async () => {
    const zipPath = await makeZip({ 'main.tex': 'hello' })

    await expect(readZip(zipPath, { maxEntryBytes: 4 })).rejects.toThrow(
      'Zip entry is too large.'
    )
  })

  it('rejects archives over the total uncompressed size limit', async () => {
    const zipPath = await makeZip({ 'a.tex': '12345', 'b.tex': '67890' })

    await expect(readZip(zipPath, { maxTotalBytes: 9 })).rejects.toThrow(
      'Zip archive is too large.'
    )
  })

  it('rejects archives with too many entries', async () => {
    const zipPath = await makeZip({ 'a.tex': 'a', 'b.tex': 'b' })

    await expect(readZip(zipPath, { maxEntries: 1 })).rejects.toThrow(
      'Zip archive contains too many files.'
    )
  })

  it('does not count or size metadata entries against the limits', async () => {
    const zipPath = await makeZip({
      '__MACOSX/._main.tex': 'large metadata payload',
      'main.tex': 'hello'
    })

    const files = await readZip(zipPath, { maxEntries: 1, maxTotalBytes: 5 })

    expect([...files.keys()]).toEqual(['main.tex'])
  })

  it('applies limits during extraction as well', async () => {
    const zipPath = await makeZip({ 'main.tex': 'hello' })
    const target = await makeTempDir('open-prism-unzip-')

    await expect(extractZip(zipPath, target, { maxEntries: 0 })).rejects.toThrow(
      'Zip archive contains too many files.'
    )
    expect(await readdir(target)).toEqual([])
  })
})

describe('zip-slip protection', () => {
  it('rejects traversal entries without writing outside the target directory', async () => {
    const zipPath = await makeZip({ '../escape.tex': 'pwned' })
    const sandbox = await makeTempDir('open-prism-slip-')
    const target = join(sandbox, 'target')
    await mkdir(target)
    const escaped = join(sandbox, 'escape.tex')

    await expect(readZip(zipPath)).rejects.toThrow('unsafe')
    await expect(extractZip(zipPath, target)).rejects.toThrow('unsafe')

    await expect(readFile(escaped, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(target)).toEqual([])
  })
})
