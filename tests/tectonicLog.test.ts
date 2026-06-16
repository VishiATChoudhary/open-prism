import { describe, it, expect } from 'vitest'
import { summarizeTectonicLog } from '@shared/tectonicLog'

describe('summarizeTectonicLog', () => {
  it('returns the first LaTeX error line', () => {
    const log = ['Running TeX ...', 'main.tex:5: Undefined control sequence.', 'l.5 \\foo', 'more noise'].join('\n')
    expect(summarizeTectonicLog(log)).toBe('main.tex:5: Undefined control sequence.')
  })

  it('falls back to first "error" line when no file:line match', () => {
    const log = 'warning: x\nerror: package not found\nbye'
    expect(summarizeTectonicLog(log)).toBe('error: package not found')
  })

  it('returns a generic message when nothing matches', () => {
    expect(summarizeTectonicLog('all good, no problems')).toBe('Compilation failed (see log).')
  })
})
