const LATEX_SIGNALS = ['\\documentclass', '\\begin{', '\\section', '\\usepackage', '\\[', '\\(']

function looksLikeLatex(s: string): boolean {
  return LATEX_SIGNALS.some((sig) => s.includes(sig))
}

/**
 * Returns the inner content of the first LaTeX code block in an AI reply,
 * or null if none is found.
 */
export function extractLatexBlock(reply: string): string | null {
  const fence = /```(\w*)\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = fence.exec(reply)) !== null) {
    const lang = m[1].toLowerCase()
    const body = m[2].replace(/\n$/, '')
    if (lang === 'latex' || lang === 'tex') return body
    if (lang === '' && looksLikeLatex(body)) return body
  }
  return null
}
