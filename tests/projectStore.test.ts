import { describe, expect, it } from 'vitest'
import { validateZipEntries } from '../src/main/services/projectStore'

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
