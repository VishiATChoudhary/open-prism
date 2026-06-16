import { describe, expect, it } from 'vitest'
import { findSourceMatch } from '../src/renderer/lib/sourceJump'

describe('findSourceMatch', () => {
  it('finds an exact source span', () => {
    expect(findSourceMatch('Before \\section{Introduction}', 'Introduction')).toEqual({
      from: 16,
      to: 28
    })
  })

  it('matches case-insensitively', () => {
    expect(findSourceMatch('Hello World', 'hello world')).toEqual({ from: 0, to: 11 })
  })

  it('matches across source whitespace differences', () => {
    expect(findSourceMatch('A paragraph with\nwrapped   text.', 'with wrapped text')).toEqual({
      from: 12,
      to: 31
    })
  })

  it('ignores selections that are too short', () => {
    expect(findSourceMatch('abc', 'a')).toBeNull()
  })
})
