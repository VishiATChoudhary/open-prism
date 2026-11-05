import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { extractZip, readZip, validateZipEntries } from '../src/main/services/zip'

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

afterEach(async () => {
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
    const target = await mkdtemp(join(tmpdir(), 'open-prism-unzip-'))
    cleanup.push(target)

    await extractZip(zipPath, target)

    expect(await readFile(join(target, 'paper', 'main.tex'), 'utf8')).toBe('hello')
  })

  it('rejects unsafe entries', () => {
    expect(() => validateZipEntries(['../escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['/tmp/escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['paper\\escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['C:/escape.tex'])).toThrow('unsafe')
  })
})
