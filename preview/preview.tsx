import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/spectral/300.css'
import '@fontsource/spectral/400.css'
import '@fontsource/spectral/500.css'
import '@fontsource/spectral/300-italic.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import App from '@/App'
import '@/index.css'

const SAMPLE_TEX = `\\documentclass{article}
\\usepackage{amsmath}
\\title{On the Refraction of Ideas}
\\author{Open Prism}
\\begin{document}
\\maketitle
\\section{Introduction}
We consider a beam of intent passing through a prism.
\\begin{equation}
  n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2
\\end{equation}
\\end{document}`

const ASSISTANT = `I've drafted a short article with a title block and Snell's law as a numbered equation.

Key choices:
- \`amsmath\` for the \`equation\` environment
- a \`\\section{Introduction}\` to anchor the body

\`\`\`latex
\\documentclass{article}
\\usepackage{amsmath}
\\title{On the Refraction of Ideas}
\\begin{document}
\\maketitle
\\end{document}
\`\`\`

Compile with ⌘↵ when you're ready.`

const REASONING = `reading current source (12 lines)…
plan: add amsmath, title block, one numbered equation
writing preamble
writing body + equation
done — proposing replacement`

const projects = [
  { name: 'Refraction Paper', dir: '/Users/you/.openprism/refraction-paper', entry: 'main.tex', updatedAt: Date.now() - 3_600_000 },
  { name: 'Thesis Chapter 3', dir: '/Users/you/.openprism/thesis-ch3', entry: 'main.tex', updatedAt: Date.now() - 86_400_000 },
  { name: 'IEEE Submission', dir: '/Users/you/.openprism/ieee-submission', entry: 'main.tex', updatedAt: Date.now() - 5 * 86_400_000 }
]

function makeMeta() {
  return {
    entry: 'main.tex',
    settings: { provider: 'claude' as const, model: '' },
    chatHistory: [
      { role: 'user' as const, content: 'Write a short article with a title and Snell’s law equation.' },
      { role: 'assistant' as const, content: ASSISTANT, reasoning: REASONING, applied: true }
    ]
  }
}

;(window as any).api = {
  getSettings: async () => ({ provider: 'claude', model: '' }),
  setSettings: async () => {},
  listProjects: async () => ({ rootDir: '~/.openprism', projects }),
  newProject: async (name: string) => ({
    dir: `/Users/you/.openprism/${name}`,
    meta: makeMeta(),
    source: SAMPLE_TEX
  }),
  openProject: async (dir: string) => ({ dir, meta: makeMeta(), source: SAMPLE_TEX }),
  saveProject: async () => {},
  readFile: async () => '',
  readBinaryFile: async () => new Uint8Array(),
  compile: async () => ({ ok: true, pdfPath: '', log: '', summary: '' }),
  chat: async (
    _args: unknown,
    onChunk: (c: string) => void
  ): Promise<string> => {
    const parts = REASONING.split('\n')
    for (const p of parts) {
      await new Promise((r) => setTimeout(r, 400))
      onChunk(p + '\n')
    }
    await new Promise((r) => setTimeout(r, 400))
    onChunk('\n' + ASSISTANT)
    return REASONING + '\n\n' + ASSISTANT
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
