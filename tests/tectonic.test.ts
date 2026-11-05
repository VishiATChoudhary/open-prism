import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compile } from '../src/main/services/tectonic'

const { spawnMock, resolveExecutableMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  resolveExecutableMock: vi.fn()
}))

vi.mock('cross-spawn', () => ({ default: spawnMock }))
vi.mock('../src/main/services/spawnEnv', () => ({
  resolveSpawnEnv: async () => process.env,
  resolveExecutable: resolveExecutableMock
}))

const tempDirs: string[] = []

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'open-prism-tectonic-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('compile', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    resolveExecutableMock.mockReset()
  })

  it('fails closed without spawning when Tectonic is not on PATH', async () => {
    resolveExecutableMock.mockReturnValue(null)
    const projectDir = makeProjectDir()

    const result = await compile(projectDir, 'main.tex')

    expect(resolveExecutableMock).toHaveBeenCalledWith('tectonic', process.env)
    expect(spawnMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      log: 'Tectonic was not found on PATH.',
      summary:
        'Tectonic not found. Install it and ensure it is on PATH: ' +
        'https://tectonic-typesetting.github.io'
    })
    expect(result).not.toHaveProperty('pdfPath')
    expect(existsSync(join(projectDir, 'build'))).toBe(false)
  })
})
