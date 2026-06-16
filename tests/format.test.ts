import { describe, expect, it } from 'vitest'
import { formatElapsed } from '@shared/format'

describe('formatElapsed', () => {
  it('shows tenths of a second under a minute', () => {
    expect(formatElapsed(0)).toBe('0.0s')
    expect(formatElapsed(450)).toBe('0.5s')
    expect(formatElapsed(1234)).toBe('1.2s')
    expect(formatElapsed(59_900)).toBe('59.9s')
  })

  it('switches to minutes and zero-pads seconds at/over a minute', () => {
    expect(formatElapsed(60_000)).toBe('1m 00s')
    expect(formatElapsed(63_000)).toBe('1m 03s')
    expect(formatElapsed(125_000)).toBe('2m 05s')
  })

  it('guards against negative and non-finite input', () => {
    expect(formatElapsed(-10)).toBe('0.0s')
    expect(formatElapsed(Number.NaN)).toBe('0.0s')
    expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe('0.0s')
  })
})
