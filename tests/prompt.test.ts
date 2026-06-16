import { describe, it, expect } from 'vitest'
import { buildPrompt } from '@shared/prompt'

describe('buildPrompt', () => {
  const history = [
    { role: 'user' as const, content: 'make a title' },
    { role: 'assistant' as const, content: 'done' }
  ]

  it('includes system instructions, source, history, and the new message', () => {
    const out = buildPrompt({ source: '\\documentclass{article}', history, message: 'add a section' })
    expect(out).toContain('LaTeX')
    expect(out).toContain('```latex')
    expect(out).toContain('\\documentclass{article}')
    expect(out).toContain('make a title')
    expect(out).toContain('done')
    expect(out).toContain('add a section')
  })

  it('caps history to the most recent 6 messages', () => {
    const long = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `m${i}`
    }))
    const out = buildPrompt({ source: 'x', history: long, message: 'go' })
    expect(out).toContain('m19')
    expect(out).not.toContain('m13')
  })

  it('handles empty source', () => {
    const out = buildPrompt({ source: '', history: [], message: 'start a doc' })
    expect(out).toContain('start a doc')
  })
})
