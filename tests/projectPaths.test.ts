import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertWindowsSafeName,
  normalizeEntryPath,
  normalizeProjectEntry,
  toPosixRelative
} from '../src/main/services/projectPaths'

describe('project path portability', () => {
  it('normalizes Windows entry separators', () => {
    expect(normalizeEntryPath('chapters\\intro.tex')).toBe('chapters/intro.tex')
  })

  it('returns a forward-slash relative path', () => {
    const root = join('root')
    expect(toPosixRelative(root, join(root, 'chapters', 'intro.tex'))).toBe(
      'chapters/intro.tex'
    )
  })

  it('rejects Windows reserved names and trailing dots', () => {
    expect(() => assertWindowsSafeName('CON')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('con.tex')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('COM1')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('notes.')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('main.tex')).not.toThrow()
  })

  it('rejects Windows-invalid characters', () => {
    expect(() => assertWindowsSafeName('foo:bar')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('a<b')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('a>b')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('a"b')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('a|b')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('a?b')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('a*b')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName(`a${String.fromCharCode(0)}b`)).toThrow(
      'not a valid name'
    )
  })
})

describe('normalizeProjectEntry', () => {
  it('accepts relative entries, including legacy Windows separators', () => {
    expect(normalizeProjectEntry('main.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('sub/main.tex')).toBe('sub/main.tex')
    expect(normalizeProjectEntry('sub\\main.tex')).toBe('sub/main.tex')
    expect(normalizeProjectEntry('  sub\\main.tex  ')).toBe('sub/main.tex')
  })

  it('falls back to main.tex for traversal attempts', () => {
    expect(normalizeProjectEntry('../../Windows/win.ini')).toBe('main.tex')
    expect(normalizeProjectEntry('sub/../../x.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('..\\..\\Windows\\win.ini')).toBe('main.tex')
    expect(normalizeProjectEntry('sub//main.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('./main.tex')).toBe('main.tex')
  })

  it('falls back to main.tex for absolute paths and drive letters', () => {
    expect(normalizeProjectEntry('/abs.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('C:/x.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('C:\\x.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('\\\\server\\share\\main.tex')).toBe('main.tex')
  })

  it('falls back to main.tex for empty, non-string, or Windows-unsafe entries', () => {
    expect(normalizeProjectEntry('')).toBe('main.tex')
    expect(normalizeProjectEntry('   ')).toBe('main.tex')
    expect(normalizeProjectEntry(undefined)).toBe('main.tex')
    expect(normalizeProjectEntry(42)).toBe('main.tex')
    expect(normalizeProjectEntry('CON.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('foo:bar.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('sub /main.tex')).toBe('main.tex')
    expect(normalizeProjectEntry('trailing.tex ')).toBe('trailing.tex')
  })
})
