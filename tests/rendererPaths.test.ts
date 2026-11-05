import { describe, expect, it } from 'vitest'
import {
  isSameOrInside,
  joinDisplayPath,
  movePath,
  normalizeSeparators,
  parentPath,
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

describe('parentPath', () => {
  it('returns the parent for POSIX paths', () => {
    expect(parentPath('/proj/main.tex')).toBe('/proj')
    expect(parentPath('/proj/sub/main.tex')).toBe('/proj/sub')
  })

  it('returns the parent for Windows paths', () => {
    expect(parentPath('C:\\proj\\main.tex')).toBe('C:\\proj')
    expect(parentPath('C:\\proj\\sub\\main.tex')).toBe('C:\\proj\\sub')
    expect(parentPath('C:\\proj\\sub/main.tex')).toBe('C:\\proj\\sub')
  })

  it('handles root paths', () => {
    expect(parentPath('/main.tex')).toBe('')
    expect(parentPath('C:\\main.tex')).toBe('C:')
    expect(parentPath('/')).toBe('')
    expect(parentPath('C:\\')).toBe('C:')
  })

  it('returns paths without a separator unchanged', () => {
    expect(parentPath('main.tex')).toBe('main.tex')
    expect(parentPath('')).toBe('')
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

describe('movePath', () => {
  it('maps an exact Windows match to the new path', () => {
    expect(movePath('C:\\proj\\main.tex', 'C:\\proj\\main.tex', 'C:\\proj\\intro.tex')).toBe(
      'C:\\proj\\intro.tex'
    )
    expect(movePath('C:/proj/main.tex', 'C:\\proj\\main.tex', 'C:\\proj\\intro.tex')).toBe(
      'C:\\proj\\intro.tex'
    )
  })

  it('rewrites Windows descendants with backslashes', () => {
    expect(movePath('C:\\proj\\sub\\main.tex', 'C:\\proj', 'D:\\work')).toBe(
      'D:\\work\\sub\\main.tex'
    )
    expect(movePath('C:/proj/sub/main.tex', 'C:\\proj', 'D:\\work')).toBe(
      'D:\\work\\sub\\main.tex'
    )
    expect(movePath('C:\\proj\\sub\\main.tex', 'C:\\proj\\sub\\', 'C:\\proj\\chapters')).toBe(
      'C:\\proj\\chapters\\main.tex'
    )
  })

  it('rewrites POSIX descendants with forward slashes', () => {
    expect(movePath('/proj/sub/main.tex', '/proj', '/work')).toBe('/work/sub/main.tex')
    expect(movePath('/proj/sub/main.tex', '/proj/sub', '/proj/chapters')).toBe(
      '/proj/chapters/main.tex'
    )
    expect(movePath('/proj/main.tex', '/proj/main.tex', '/proj/intro.tex')).toBe(
      '/proj/intro.tex'
    )
  })

  it('leaves unrelated paths and sibling prefixes untouched', () => {
    expect(movePath('C:\\proj2\\main.tex', 'C:\\proj', 'C:\\other')).toBe('C:\\proj2\\main.tex')
    expect(movePath('/project/main.tex', '/proj', '/other')).toBe('/project/main.tex')
    expect(movePath('D:\\proj\\main.tex', 'C:\\proj', 'C:\\other')).toBe('D:\\proj\\main.tex')
    expect(movePath('/proj/main.tex', '/proj2', '/other')).toBe('/proj/main.tex')
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

  it('normalizes nested relative names to Windows separators', () => {
    expect(joinDisplayPath('C:\\proj', 'sub/main.tex')).toBe('C:\\proj\\sub\\main.tex')
    expect(joinDisplayPath('C:\\proj\\', 'sub/main.tex')).toBe('C:\\proj\\sub\\main.tex')
    expect(joinDisplayPath('C:\\proj', 'sub\\main.tex')).toBe('C:\\proj\\sub\\main.tex')
  })

  it('keeps POSIX nested relative names unchanged', () => {
    expect(joinDisplayPath('/proj', 'sub/main.tex')).toBe('/proj/sub/main.tex')
  })
})
