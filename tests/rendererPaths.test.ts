import { describe, expect, it } from 'vitest'
import {
  isSameOrInside,
  joinDisplayPath,
  normalizeSeparators,
  relativeToProject
} from '../src/renderer/lib/paths'

describe('normalizeSeparators', () => {
  it('converts backslashes and collapses duplicate forward slashes', () => {
    expect(normalizeSeparators('C:\\Users\\gusta\\project')).toBe('C:/Users/gusta/project')
    expect(normalizeSeparators('C:/Users//gusta///project')).toBe('C:/Users/gusta/project')
    expect(normalizeSeparators('paper\\assets\\\\figure.png')).toBe('paper/assets/figure.png')
  })

  it('strips trailing separators', () => {
    expect(normalizeSeparators('C:\\Users\\gusta\\')).toBe('C:/Users/gusta')
    expect(normalizeSeparators('/home/gusta/project//')).toBe('/home/gusta/project')
    expect(normalizeSeparators('')).toBe('')
  })
})

describe('relativeToProject', () => {
  it('returns relative paths for Windows inputs', () => {
    expect(relativeToProject('C:\\proj', 'C:\\proj\\sub\\main.tex')).toBe('sub/main.tex')
    expect(relativeToProject('C:\\proj\\', 'C:\\proj\\main.tex')).toBe('main.tex')
  })

  it('returns relative paths for POSIX inputs and trailing separators', () => {
    expect(relativeToProject('/proj', '/proj/sub/main.tex')).toBe('sub/main.tex')
    expect(relativeToProject('/proj/', '/proj/sub/main.tex')).toBe('sub/main.tex')
  })

  it('returns the normalized path for outside paths', () => {
    expect(relativeToProject('C:\\proj', 'C:\\other\\main.tex')).toBe('C:/other/main.tex')
    expect(relativeToProject('/proj', '/project/main.tex')).toBe('/project/main.tex')
  })

  it('returns an empty relative path for the project directory itself', () => {
    expect(relativeToProject('C:\\proj\\', 'C:/proj')).toBe('')
    expect(relativeToProject('/proj/', '/proj')).toBe('')
  })
})

describe('isSameOrInside', () => {
  it('matches the same path with either separator or trailing separators', () => {
    expect(isSameOrInside('C:\\proj', 'C:/proj')).toBe(true)
    expect(isSameOrInside('C:\\proj\\', 'C:\\proj')).toBe(true)
    expect(isSameOrInside('/proj/', '/proj')).toBe(true)
  })

  it('matches children with either separator', () => {
    expect(isSameOrInside('C:\\proj', 'C:\\proj\\sub\\main.tex')).toBe(true)
    expect(isSameOrInside('/proj', '/proj/sub/main.tex')).toBe(true)
    expect(isSameOrInside('/proj/', '/proj/sub/')).toBe(true)
  })

  it('rejects siblings, prefix collisions, and outside paths', () => {
    expect(isSameOrInside('/proj', '/project/main.tex')).toBe(false)
    expect(isSameOrInside('C:\\proj', 'C:\\proj2\\main.tex')).toBe(false)
    expect(isSameOrInside('C:\\proj', 'D:\\proj\\main.tex')).toBe(false)
  })
})

describe('joinDisplayPath', () => {
  it('uses backslashes for Windows directories', () => {
    expect(joinDisplayPath('C:\\Users\\gusta\\proj', 'main.tex')).toBe(
      'C:\\Users\\gusta\\proj\\main.tex'
    )
    expect(joinDisplayPath('C:\\Users\\gusta\\proj\\', 'main.tex')).toBe(
      'C:\\Users\\gusta\\proj\\main.tex'
    )
  })

  it('uses forward slashes for POSIX directories', () => {
    expect(joinDisplayPath('/home/gusta/proj', 'main.tex')).toBe('/home/gusta/proj/main.tex')
    expect(joinDisplayPath('/home/gusta/proj///', 'main.tex')).toBe(
      '/home/gusta/proj/main.tex'
    )
  })
})
