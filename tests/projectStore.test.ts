import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importProjectZip, openProject, saveProject } from '../src/main/services/projectStore'
import { validateZipEntries } from '../src/main/services/zip'
import { DEFAULT_SETTINGS } from '../src/shared/settings'

const { home } = vi.hoisted(() => ({ home: { value: '' } }))

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return { ...actual, homedir: () => home.value }
})

describe('validateZipEntries', () => {
  it('accepts normal project zip entries', () => {
    expect(() =>
      validateZipEntries(['paper/main.tex', 'paper/assets/figure.png', 'paper/.prism.json'])
    ).not.toThrow()
  })

  it('rejects unsafe zip paths', () => {
    expect(() => validateZipEntries(['../escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['/tmp/escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['paper/../../escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['paper\\escape.tex'])).toThrow('unsafe')
  })
})

describe('project metadata entry', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(
      cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    )
  })

  async function projectWithMeta(meta: Record<string, unknown>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'open-prism-project-'))
    cleanup.push(dir)
    await writeFile(join(dir, 'main.tex'), 'safe', 'utf8')
    await writeFile(join(dir, '.prism.json'), JSON.stringify(meta), 'utf8')
    return dir
  }

  it('falls back to main.tex when the stored entry escapes the project', async () => {
    const dir = await projectWithMeta({ entry: '../../../../Windows/win.ini' })

    const result = await openProject(dir, DEFAULT_SETTINGS)

    expect(result.meta.entry).toBe('main.tex')
    expect(result.source).toBe('safe')
  })

  it('accepts legacy Windows separators in the stored entry', async () => {
    const dir = await projectWithMeta({ entry: 'sub\\main.tex' })
    await mkdir(join(dir, 'sub'))
    await writeFile(join(dir, 'sub', 'main.tex'), 'nested', 'utf8')

    const result = await openProject(dir, DEFAULT_SETTINGS)

    expect(result.meta.entry).toBe('sub/main.tex')
    expect(result.source).toBe('nested')
  })

  it('normalizes the entry before writing in saveProject', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-prism-save-'))
    cleanup.push(dir)
    await mkdir(join(dir, 'sub'))

    await saveProject(
      dir,
      { entry: 'sub\\main.tex', settings: DEFAULT_SETTINGS, chatHistory: [] },
      'normalized'
    )

    expect(await readFile(join(dir, 'sub', 'main.tex'), 'utf8')).toBe('normalized')
    const stored = JSON.parse(await readFile(join(dir, '.prism.json'), 'utf8'))
    expect(stored.entry).toBe('sub/main.tex')
  })
})

describe('importProjectZip', () => {
  const cleanup: string[] = []

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-prism-home-'))
    cleanup.push(dir)
    home.value = dir
  })

  afterEach(async () => {
    home.value = ''
    await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  async function makeZip(name: string, files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'open-prism-zip-import-'))
    cleanup.push(dir)
    const zipPath = join(dir, name)
    const payload = Object.fromEntries(
      Object.entries(files).map(([entry, body]) => [entry, strToU8(body)])
    )
    await writeFile(zipPath, zipSync(payload))
    return zipPath
  }

  it('imports a nested project and stores its entry path', async () => {
    const source = '\\documentclass{article}\n\\begin{document}nested\\end{document}\n'
    const zipPath = await makeZip('nested-project.zip', {
      '.prism.json': JSON.stringify({ entry: 'paper/main.tex' }),
      'paper/main.tex': source
    })

    const result = await importProjectZip(zipPath, DEFAULT_SETTINGS)

    expect(result.meta.entry).toBe('paper/main.tex')
    expect(result.source).toBe(source)
    expect(await readFile(join(result.dir, 'paper', 'main.tex'), 'utf8')).toBe(source)
    const stored = JSON.parse(await readFile(join(result.dir, '.prism.json'), 'utf8'))
    expect(stored.entry).toBe('paper/main.tex')
  })

  it('ignores macOS metadata entries', async () => {
    const source = '\\documentclass{article}\nclean\n'
    const zipPath = await makeZip('mac-style.zip', {
      '__MACOSX/._main.tex': 'resource fork',
      'paper/main.tex': source
    })

    const result = await importProjectZip(zipPath, DEFAULT_SETTINGS)

    expect(result.meta.entry).toBe('main.tex')
    expect(result.source).toBe(source)
    await expect(access(join(result.dir, '__MACOSX'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(result.dir, '.DS_Store'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects traversal entries without creating a project', async () => {
    const zipPath = await makeZip('escape.zip', { '../escape.tex': 'pwned' })

    await expect(importProjectZip(zipPath, DEFAULT_SETTINGS)).rejects.toThrow('unsafe')

    await expect(access(join(home.value, '.openprism'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
