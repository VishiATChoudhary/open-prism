import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSpawnPath, resolveExecutable } from '../src/main/services/spawnEnv'

const isWindows = process.platform === 'win32'
const pathSeparator = isWindows ? ';' : ':'
const BIN_NAME = isWindows ? 'tool.cmd' : 'tool'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'open-prism-spawn-env-'))
  tempDirs.push(dir)
  return dir
}

function writeFakeExecutable(dir: string, name: string): string {
  const file = join(dir, name)
  writeFileSync(file, isWindows ? '@echo off\r\n' : '#!/bin/sh\nexit 0\n')
  if (!isWindows) chmodSync(file, 0o755)
  return file
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('buildSpawnPath', () => {
  it('merges Windows dirs with semicolons and case-insensitive dedupe', () => {
    const result = buildSpawnPath({
      platform: 'win32',
      envPath: 'C:\\Windows;C:\\Tools;c:\\tools',
      home: 'C:\\Users\\me',
      env: {
        APPDATA: 'C:\\Users\\me\\AppData\\Roaming',
        ProgramData: 'C:\\ProgramData'
      }
    })

    expect(result.split(';')).toEqual([
      'C:\\Windows',
      'C:\\Tools',
      'C:\\Users\\me\\.local\\bin',
      'C:\\Users\\me\\AppData\\Roaming\\npm',
      'C:\\Users\\me\\.cargo\\bin',
      'C:\\Users\\me\\scoop\\shims',
      'C:\\ProgramData\\chocolatey\\bin'
    ])
  })

  it('keeps the POSIX login-shell PATH first and uses colons', () => {
    const result = buildSpawnPath({
      platform: 'darwin',
      envPath: '/usr/bin:/bin',
      home: '/Users/me',
      env: {},
      loginShellPath: '/opt/homebrew/bin:/usr/local/bin'
    })

    expect(result.split(':').slice(0, 4)).toEqual([
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin'
    ])
    expect(result).toContain('/Users/me/.local/bin')
  })

  it('handles an empty PATH without emitting empty entries', () => {
    const result = buildSpawnPath({
      platform: 'win32',
      envPath: '',
      home: 'C:\\Users\\me',
      env: {}
    })

    expect(result.split(';')).toEqual([
      'C:\\Users\\me\\.local\\bin',
      'C:\\Users\\me\\.cargo\\bin',
      'C:\\Users\\me\\scoop\\shims'
    ])
  })

  it('omits APPDATA and ProgramData dirs when those variables are unset', () => {
    const result = buildSpawnPath({
      platform: 'win32',
      envPath: 'C:\\Windows',
      home: 'C:\\Users\\me',
      env: {}
    })

    const dirs = result.split(';')
    expect(dirs).toEqual([
      'C:\\Windows',
      'C:\\Users\\me\\.local\\bin',
      'C:\\Users\\me\\.cargo\\bin',
      'C:\\Users\\me\\scoop\\shims'
    ])
    expect(dirs.some((dir) => dir.includes('AppData'))).toBe(false)
    expect(dirs.some((dir) => dir.includes('chocolatey'))).toBe(false)
  })

  it('skips empty segments and dedupes repeated Windows entries', () => {
    const result = buildSpawnPath({
      platform: 'win32',
      envPath: ';;C:\\Tools;;c:\\tools;',
      home: 'C:\\Users\\me',
      env: {}
    })

    const dirs = result.split(';')
    expect(dirs).not.toContain('')
    expect(dirs.filter((dir) => dir.toLowerCase() === 'c:\\tools')).toHaveLength(1)
  })

  it('skips empty segments and dedupes repeated POSIX entries', () => {
    const result = buildSpawnPath({
      platform: 'darwin',
      envPath: '::/usr/bin:/usr/bin:',
      home: '/Users/me',
      env: {}
    })

    const dirs = result.split(':')
    expect(dirs).not.toContain('')
    expect(dirs.filter((dir) => dir === '/usr/bin')).toHaveLength(1)
  })
})

describe('resolveExecutable', () => {
  it('finds an executable in an absolute PATH directory', () => {
    const dir = makeTempDir()
    const expected = writeFakeExecutable(dir, BIN_NAME)

    expect(resolveExecutable('tool', { PATH: dir })).toBe(expected)
  })

  it('falls back to Path when PATH is missing', () => {
    const dir = makeTempDir()
    const expected = writeFakeExecutable(dir, BIN_NAME)

    expect(resolveExecutable('tool', { Path: dir })).toBe(expected)
  })

  it('strips surrounding quotes from PATH entries', () => {
    const dir = makeTempDir()
    const expected = writeFakeExecutable(dir, BIN_NAME)

    expect(resolveExecutable('tool', { PATH: `"${dir}"` })).toBe(expected)
  })

  it('ignores relative PATH entries', () => {
    const dir = makeTempDir()
    const expected = writeFakeExecutable(dir, BIN_NAME)
    const envPath = ['.', 'relative', dir, '../bin'].join(pathSeparator)

    expect(resolveExecutable('tool', { PATH: envPath })).toBe(expected)
  })

  it('returns null when PATH only contains relative entries', () => {
    const envPath = ['.', 'relative', '../bin'].join(pathSeparator)

    expect(resolveExecutable('tool', { PATH: envPath })).toBeNull()
  })

  it('returns null when the binary is not on PATH', () => {
    const dir = makeTempDir()
    writeFakeExecutable(dir, BIN_NAME)

    expect(resolveExecutable('different-tool', { PATH: dir })).toBeNull()
  })

  it('returns null when PATH is empty or missing', () => {
    expect(resolveExecutable('tool', { PATH: '' })).toBeNull()
    expect(resolveExecutable('tool', {})).toBeNull()
  })

  it('ignores PATH directories that do not exist', () => {
    const missingDir = join(makeTempDir(), 'missing')

    expect(resolveExecutable('tool', { PATH: missingDir })).toBeNull()
  })

  it('selects the executable from PATH rather than the working directory', () => {
    const root = makeTempDir()
    const pathDir = join(root, 'tools')
    const otherDir = join(root, 'project')
    mkdirSync(pathDir)
    mkdirSync(otherDir)

    // Decoy executable in the (untrusted) working directory.
    writeFakeExecutable(otherDir, BIN_NAME)
    const expected = writeFakeExecutable(pathDir, BIN_NAME)

    const previousCwd = process.cwd()
    try {
      process.chdir(otherDir)
      expect(resolveExecutable('tool', { PATH: pathDir })).toBe(expected)
    } finally {
      process.chdir(previousCwd)
    }
  })

  it.runIf(isWindows)('finds a .cmd shim using the default PATHEXT entries', () => {
    const dir = makeTempDir()
    const expected = writeFakeExecutable(dir, 'fake-cli.cmd')

    expect(resolveExecutable('fake-cli', { PATH: dir }, 'win32')).toBe(expected)
  })

  it.runIf(isWindows)('matches PATHEXT extensions case-insensitively', () => {
    const dir = makeTempDir()
    const file = join(dir, 'tool.CMD')
    writeFileSync(file, '@echo off\r\n')

    expect(resolveExecutable('tool', { PATH: dir, PATHEXT: '.cmd' }, 'win32')).toBe(file)
  })

  it.runIf(isWindows)('uses the exact name when the binary already has an extension', () => {
    const dir = makeTempDir()
    const expected = writeFakeExecutable(dir, 'tool.cmd')

    expect(resolveExecutable('tool.cmd', { PATH: dir, PATHEXT: '.BAT' }, 'win32')).toBe(expected)
  })

  it.runIf(!isWindows)('requires an executable file on POSIX', () => {
    const dir = makeTempDir()
    const file = join(dir, 'tool')
    writeFileSync(file, '#!/bin/sh\n')
    expect(resolveExecutable('tool', { PATH: dir }, 'darwin')).toBeNull()

    chmodSync(file, 0o755)
    expect(resolveExecutable('tool', { PATH: dir }, 'darwin')).toBe(file)
  })

  it.runIf(!isWindows)('skips directories on POSIX', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'tool'))

    expect(resolveExecutable('tool', { PATH: dir }, 'linux')).toBeNull()
  })
})
