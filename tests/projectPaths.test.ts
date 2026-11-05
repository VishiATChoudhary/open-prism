import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertWindowsSafeName,
  normalizeEntryPath,
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
})
