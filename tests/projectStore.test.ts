import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openProject } from '../src/main/services/projectStore'
import { validateZipEntries } from '../src/main/services/zip'
import { DEFAULT_SETTINGS } from '../src/shared/settings'

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
})
