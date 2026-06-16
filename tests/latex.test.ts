import { describe, it, expect } from 'vitest'
import { extractLatexBlock } from '@shared/latex'

describe('extractLatexBlock', () => {
  it('extracts a ```latex fenced block', () => {
    const reply = 'Sure:\n```latex\n\\documentclass{article}\n\\begin{document}Hi\\end{document}\n```\nDone.'
    expect(extractLatexBlock(reply)).toBe('\\documentclass{article}\n\\begin{document}Hi\\end{document}')
  })

  it('extracts a ```tex fenced block', () => {
    const reply = '```tex\n\\section{A}\n```'
    expect(extractLatexBlock(reply)).toBe('\\section{A}')
  })

  it('extracts a plain ``` block when content looks like latex', () => {
    const reply = '```\n\\documentclass{article}\n```'
    expect(extractLatexBlock(reply)).toBe('\\documentclass{article}')
  })

  it('returns null when no fenced block present', () => {
    expect(extractLatexBlock('I cannot do that.')).toBeNull()
  })

  it('returns the first block when multiple present', () => {
    const reply = '```latex\nA\n```\ntext\n```latex\nB\n```'
    expect(extractLatexBlock(reply)).toBe('A')
  })

  it('ignores a plain block that does not look like latex', () => {
    expect(extractLatexBlock('```\njust prose\n```')).toBeNull()
  })
})
