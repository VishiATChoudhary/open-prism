# Open Prism LaTeX Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Electron desktop app where an AI (spawned `claude`/`codex` CLI) writes and edits LaTeX in a source editor, the user compiles to PDF with Tectonic, and the PDF renders in a side-by-side viewer.

**Architecture:** Electron with three layers — Main (Node: filesystem + child processes via IPC), Preload (`contextBridge` typed `window.api`), Renderer (React + shadcn UI). Pure logic (prompt builder, LaTeX extractor, Tectonic log parsing) lives in `shared/` and is unit-tested with Vitest. Electron/UI glue is built then manually smoke-tested.

**Tech Stack:** electron-vite, Electron, React, TypeScript, Tailwind CSS, shadcn/ui, CodeMirror 6, pdfjs-dist, Tectonic, Vitest.

---

## File Structure

```
open-prism/
  package.json
  electron.vite.config.ts
  tsconfig.json
  tailwind.config.js
  postcss.config.js
  vitest.config.ts
  index.html
  src/
    main/
      index.ts                 # app bootstrap, BrowserWindow
      ipc/
        register.ts            # wire all handlers
        project.ts             # project:new/open/save
        file.ts                # file:read/write
        compile.ts             # compile handler
        ai.ts                  # ai:chat handler (streaming)
        settings.ts            # settings:get/set
      services/
        tectonic.ts            # spawn tectonic, return pdf path or log
        aiCli.ts               # spawn claude/codex, stream stdout
        projectStore.ts        # read/write .prism.json + scaffold
        appSettings.ts         # global defaults in userData
    preload/
      index.ts                 # contextBridge -> window.api
    shared/
      latex.ts                 # extractLatexBlock (pure)
      prompt.ts                # buildPrompt (pure)
      tectonicLog.ts           # summarizeTectonicLog (pure)
      types.ts                 # shared TS types
    renderer/
      main.tsx                 # React root
      App.tsx                  # layout shell
      index.css                # tailwind + shadcn vars
      lib/utils.ts             # cn() helper
      components/
        ui/                    # shadcn generated components
        TopBar.tsx
        EditorPane.tsx         # CodeMirror
        PdfPane.tsx            # pdf.js
        ChatPane.tsx
        ErrorLog.tsx
        SettingsDialog.tsx
      state/
        useProject.ts          # zustand store: doc/source/pdf/chat/settings
  tests/
    latex.test.ts
    prompt.test.ts
    tectonicLog.test.ts
```

---

## Task 1: Scaffold project (electron-vite + TS + Vitest)

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`, `index.html`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules
out
dist
*.log
build/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "open-prism",
  "version": "0.1.0",
  "description": "Open-source AI LaTeX compiler + PDF viewer",
  "license": "MIT",
  "main": "./out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^31.0.0",
    "electron-vite": "^2.3.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "@codemirror/lang-stex": "^6.0.0",
    "@uiw/react-codemirror": "^4.23.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.451.0",
    "pdfjs-dist": "^4.6.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-resizable-panels": "^2.1.0",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.5.0",
    "tailwindcss-animate": "^1.0.7",
    "zustand": "^4.5.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/renderer/*"], "@shared/*": ["src/shared/*"] }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["electron.vite.config.ts"]
}
```

- [ ] **Step 5: Create `electron.vite.config.ts`**

```ts
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } } },
  preload: { build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') } } },
  renderer: {
    root: '.',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, 'index.html') } }
  }
})
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] }
})
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Open Prism</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create minimal `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.on('ready-to-show', () => win.show())
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 9: Create minimal `src/preload/index.ts`**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {})
```

- [ ] **Step 10: Create `src/renderer/main.tsx`**

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 11: Create placeholder `src/renderer/App.tsx`**

```tsx
export default function App() {
  return <div className="p-4 text-sm">Open Prism — booting…</div>
}
```

- [ ] **Step 12: Create placeholder `src/renderer/index.css`**

```css
body { margin: 0; font-family: system-ui, sans-serif; }
```

- [ ] **Step 13: Install dependencies**

Run: `npm install`
Expected: completes without error; `node_modules` created.

- [ ] **Step 14: Verify dev boot**

Run: `npm run dev` (then quit with Ctrl+C after window appears)
Expected: an Electron window opens showing "Open Prism — booting…". No console errors.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: scaffold electron-vite + react + ts project"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Create `src/shared/types.ts`**

```ts
export type Provider = 'claude' | 'codex'

export interface Settings {
  provider: Provider
  model: string // empty string = CLI default
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProjectMeta {
  entry: string // e.g. "main.tex"
  settings: Settings
  chatHistory: ChatMessage[]
}

export interface CompileResult {
  ok: boolean
  pdfPath?: string // absolute path to build/<entry>.pdf on success
  log: string // full tectonic stderr/stdout
  summary: string // human-friendly first-error summary
}

export interface OpenProjectResult {
  dir: string
  meta: ProjectMeta
  source: string // contents of entry .tex
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: LaTeX block extractor (TDD, pure)

**Files:**
- Create: `src/shared/latex.ts`
- Test: `tests/latex.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/latex.test.ts`
Expected: FAIL — cannot resolve `@shared/latex`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/latex.ts
const LATEX_SIGNALS = ['\\documentclass', '\\begin{', '\\section', '\\usepackage', '\\[', '\\(']

function looksLikeLatex(s: string): boolean {
  return LATEX_SIGNALS.some((sig) => s.includes(sig))
}

/**
 * Returns the inner content of the first LaTeX code block in an AI reply,
 * or null if none is found. Recognizes ```latex / ```tex fences, and bare
 * ``` fences whose content looks like LaTeX.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/latex.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/latex.ts tests/latex.test.ts
git commit -m "feat: add latex fenced-block extractor"
```

---

## Task 4: Prompt builder (TDD, pure)

**Files:**
- Create: `src/shared/prompt.ts`
- Test: `tests/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prompt.test.ts`
Expected: FAIL — cannot resolve `@shared/prompt`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/prompt.ts
import type { ChatMessage } from './types'

const SYSTEM = `You are a LaTeX authoring assistant inside a desktop app.
You edit a single LaTeX document for the user. When the user asks for any change,
reply with the COMPLETE updated document inside one \`\`\`latex code block.
Keep the document compilable with Tectonic. Do not include explanations inside
the code block. A short sentence of context outside the block is fine.`

const HISTORY_LIMIT = 6

export function buildPrompt(args: {
  source: string
  history: ChatMessage[]
  message: string
}): string {
  const recent = args.history.slice(-HISTORY_LIMIT)
  const historyText = recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
  return [
    SYSTEM,
    '',
    'CURRENT DOCUMENT:',
    '```latex',
    args.source,
    '```',
    '',
    historyText ? `CONVERSATION SO FAR:\n${historyText}\n` : '',
    `USER REQUEST: ${args.message}`
  ].join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prompt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/prompt.ts tests/prompt.test.ts
git commit -m "feat: add prompt builder"
```

---

## Task 5: Tectonic log summarizer (TDD, pure)

**Files:**
- Create: `src/shared/tectonicLog.ts`
- Test: `tests/tectonicLog.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { summarizeTectonicLog } from '@shared/tectonicLog'

describe('summarizeTectonicLog', () => {
  it('returns the first LaTeX error line', () => {
    const log = [
      'Running TeX ...',
      'main.tex:5: Undefined control sequence.',
      'l.5 \\foo',
      'more noise'
    ].join('\n')
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tectonicLog.test.ts`
Expected: FAIL — cannot resolve `@shared/tectonicLog`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/tectonicLog.ts
/**
 * Pulls a short human-friendly error summary out of a Tectonic log.
 */
export function summarizeTectonicLog(log: string): string {
  const lines = log.split('\n')
  const fileLine = lines.find((l) => /^.+\.tex:\d+:/.test(l.trim()))
  if (fileLine) return fileLine.trim()
  const errLine = lines.find((l) => /\berror\b/i.test(l))
  if (errLine) return errLine.trim()
  return 'Compilation failed (see log).'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tectonicLog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/tectonicLog.ts tests/tectonicLog.test.ts
git commit -m "feat: add tectonic log summarizer"
```

---

## Task 6: Tectonic compile service

**Files:**
- Create: `src/main/services/tectonic.ts`

- [ ] **Step 1: Create `src/main/services/tectonic.ts`**

```ts
import { spawn } from 'child_process'
import { join, dirname, basename } from 'path'
import { promises as fs } from 'fs'
import type { CompileResult } from '../../shared/types'
import { summarizeTectonicLog } from '../../shared/tectonicLog'

/**
 * Compiles an entry .tex with Tectonic into <projectDir>/build.
 * The source argument is written to <projectDir>/<entry> before compiling.
 */
export async function compile(
  projectDir: string,
  entry: string,
  source: string
): Promise<CompileResult> {
  const entryPath = join(projectDir, entry)
  const buildDir = join(projectDir, 'build')
  await fs.mkdir(dirname(entryPath), { recursive: true })
  await fs.writeFile(entryPath, source, 'utf8')
  await fs.mkdir(buildDir, { recursive: true })

  return new Promise<CompileResult>((resolve) => {
    const proc = spawn(
      'tectonic',
      ['--outdir', buildDir, '--keep-logs', entryPath],
      { cwd: projectDir }
    )
    let log = ''
    proc.stdout.on('data', (d) => (log += d.toString()))
    proc.stderr.on('data', (d) => (log += d.toString()))

    proc.on('error', (err) => {
      resolve({
        ok: false,
        log: `Failed to start tectonic: ${err.message}`,
        summary: 'Tectonic not found. Install it: https://tectonic-typesetting.github.io'
      })
    })

    proc.on('close', (code) => {
      if (code === 0) {
        const pdfName = basename(entry).replace(/\.tex$/, '.pdf')
        resolve({ ok: true, pdfPath: join(buildDir, pdfName), log, summary: '' })
      } else {
        resolve({ ok: false, log, summary: summarizeTectonicLog(log) })
      }
    })
  })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/tectonic.ts
git commit -m "feat: add tectonic compile service"
```

---

## Task 7: AI CLI service (streaming)

**Files:**
- Create: `src/main/services/aiCli.ts`

- [ ] **Step 1: Create `src/main/services/aiCli.ts`**

```ts
import { spawn } from 'child_process'
import type { Provider } from '../../shared/types'

/**
 * Spawns the configured AI CLI with the prompt on stdin and streams stdout
 * chunks to onChunk. Resolves with the full assistant text on success.
 *
 * claude:  `claude -p` reads the prompt from stdin and prints the reply.
 * codex: `codex exec` reads the prompt from stdin and prints the reply.
 */
export function runAiCli(
  provider: Provider,
  model: string,
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const args = provider === 'claude' ? ['-p'] : []
  if (model) args.push('--model', model)
  const bin = provider === 'claude' ? 'claude' : 'codex'

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''

    proc.stdout.on('data', (d) => {
      const s = d.toString()
      out += s
      onChunk(s)
    })
    proc.stderr.on('data', (d) => (err += d.toString()))

    proc.on('error', (e) =>
      reject(new Error(`Failed to start "${bin}": ${e.message}. Is the CLI installed and on PATH?`))
    )
    proc.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err || `"${bin}" exited with code ${code}`))
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/aiCli.ts
git commit -m "feat: add ai cli streaming service"
```

---

## Task 8: Project store + app settings services

**Files:**
- Create: `src/main/services/projectStore.ts`, `src/main/services/appSettings.ts`

- [ ] **Step 1: Create `src/main/services/appSettings.ts`**

```ts
import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import type { Settings } from '../../shared/types'

const DEFAULT: Settings = { provider: 'claude', model: '' }

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function getAppSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8')
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT }
  }
}

export async function setAppSettings(s: Settings): Promise<void> {
  await fs.writeFile(settingsPath(), JSON.stringify(s, null, 2), 'utf8')
}
```

- [ ] **Step 2: Create `src/main/services/projectStore.ts`**

```ts
import { join } from 'path'
import { promises as fs } from 'fs'
import type { ProjectMeta, OpenProjectResult, Settings } from '../../shared/types'

const META_FILE = '.prism.json'

const STARTER_TEX = `\\documentclass{article}
\\begin{document}
Hello from Open Prism.
\\end{document}
`

function defaultMeta(settings: Settings): ProjectMeta {
  return { entry: 'main.tex', settings, chatHistory: [] }
}

export async function newProject(dir: string, settings: Settings): Promise<OpenProjectResult> {
  await fs.mkdir(join(dir, 'assets'), { recursive: true })
  const meta = defaultMeta(settings)
  await fs.writeFile(join(dir, meta.entry), STARTER_TEX, 'utf8')
  await fs.writeFile(join(dir, META_FILE), JSON.stringify(meta, null, 2), 'utf8')
  return { dir, meta, source: STARTER_TEX }
}

export async function openProject(dir: string, settings: Settings): Promise<OpenProjectResult> {
  let meta: ProjectMeta
  try {
    meta = JSON.parse(await fs.readFile(join(dir, META_FILE), 'utf8'))
  } catch {
    meta = defaultMeta(settings)
  }
  let source = ''
  try {
    source = await fs.readFile(join(dir, meta.entry), 'utf8')
  } catch {
    source = STARTER_TEX
  }
  return { dir, meta, source }
}

export async function saveProject(
  dir: string,
  meta: ProjectMeta,
  source: string
): Promise<void> {
  await fs.writeFile(join(dir, meta.entry), source, 'utf8')
  await fs.writeFile(join(dir, META_FILE), JSON.stringify(meta, null, 2), 'utf8')
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/services/projectStore.ts src/main/services/appSettings.ts
git commit -m "feat: add project store and app settings services"
```

---

## Task 9: IPC handlers + preload bridge

**Files:**
- Create: `src/main/ipc/register.ts`, `src/main/ipc/project.ts`, `src/main/ipc/file.ts`, `src/main/ipc/compile.ts`, `src/main/ipc/ai.ts`, `src/main/ipc/settings.ts`
- Modify: `src/main/index.ts`, `src/preload/index.ts`

- [ ] **Step 1: Create `src/main/ipc/settings.ts`**

```ts
import { ipcMain } from 'electron'
import { getAppSettings, setAppSettings } from '../services/appSettings'
import type { Settings } from '../../shared/types'

export function registerSettings(): void {
  ipcMain.handle('settings:get', () => getAppSettings())
  ipcMain.handle('settings:set', (_e, s: Settings) => setAppSettings(s))
}
```

- [ ] **Step 2: Create `src/main/ipc/project.ts`**

```ts
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { newProject, openProject, saveProject } from '../services/projectStore'
import { getAppSettings } from '../services/appSettings'
import type { ProjectMeta } from '../../shared/types'

export function registerProject(): void {
  ipcMain.handle('project:new', async () => {
    const win = BrowserWindow.getFocusedWindow()!
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose an empty folder for the new project',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return newProject(res.filePaths[0], await getAppSettings())
  })

  ipcMain.handle('project:open', async () => {
    const win = BrowserWindow.getFocusedWindow()!
    const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    return openProject(res.filePaths[0], await getAppSettings())
  })

  ipcMain.handle(
    'project:save',
    (_e, dir: string, meta: ProjectMeta, source: string) => saveProject(dir, meta, source)
  )
}
```

- [ ] **Step 3: Create `src/main/ipc/file.ts`**

```ts
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'

export function registerFile(): void {
  ipcMain.handle('file:read', (_e, path: string) => fs.readFile(path, 'utf8'))
  ipcMain.handle('file:write', (_e, path: string, data: string) =>
    fs.writeFile(path, data, 'utf8')
  )
}
```

- [ ] **Step 4: Create `src/main/ipc/compile.ts`**

```ts
import { ipcMain } from 'electron'
import { compile } from '../services/tectonic'

export function registerCompile(): void {
  ipcMain.handle('compile', (_e, dir: string, entry: string, source: string) =>
    compile(dir, entry, source)
  )
}
```

- [ ] **Step 5: Create `src/main/ipc/ai.ts`**

```ts
import { ipcMain, BrowserWindow } from 'electron'
import { runAiCli } from '../services/aiCli'
import { buildPrompt } from '../../shared/prompt'
import type { ChatMessage, Provider } from '../../shared/types'

interface ChatArgs {
  provider: Provider
  model: string
  source: string
  history: ChatMessage[]
  message: string
  requestId: string
}

export function registerAi(): void {
  ipcMain.handle('ai:chat', async (e, args: ChatArgs) => {
    const prompt = buildPrompt({
      source: args.source,
      history: args.history,
      message: args.message
    })
    const sender = e.sender
    const full = await runAiCli(args.provider, args.model, prompt, (chunk) => {
      if (!sender.isDestroyed()) sender.send(`ai:chunk:${args.requestId}`, chunk)
    })
    return full
  })
}
```

- [ ] **Step 6: Create `src/main/ipc/register.ts`**

```ts
import { registerSettings } from './settings'
import { registerProject } from './project'
import { registerFile } from './file'
import { registerCompile } from './compile'
import { registerAi } from './ai'

export function registerIpc(): void {
  registerSettings()
  registerProject()
  registerFile()
  registerCompile()
  registerAi()
}
```

- [ ] **Step 7: Wire IPC in `src/main/index.ts`** (add import + call inside `app.whenReady`)

Add near the top imports:

```ts
import { registerIpc } from './ipc/register'
```

Change the `app.whenReady().then(...)` block to call `registerIpc()` first:

```ts
app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
```

- [ ] **Step 8: Replace `src/preload/index.ts` with the typed bridge**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type {
  Settings,
  ProjectMeta,
  OpenProjectResult,
  CompileResult,
  ChatMessage,
  Provider
} from '../shared/types'

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (s: Settings): Promise<void> => ipcRenderer.invoke('settings:set', s),

  newProject: (): Promise<OpenProjectResult | null> => ipcRenderer.invoke('project:new'),
  openProject: (): Promise<OpenProjectResult | null> => ipcRenderer.invoke('project:open'),
  saveProject: (dir: string, meta: ProjectMeta, source: string): Promise<void> =>
    ipcRenderer.invoke('project:save', dir, meta, source),

  readFile: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, data: string): Promise<void> =>
    ipcRenderer.invoke('file:write', path, data),

  compile: (dir: string, entry: string, source: string): Promise<CompileResult> =>
    ipcRenderer.invoke('compile', dir, entry, source),

  chat: (
    args: {
      provider: Provider
      model: string
      source: string
      history: ChatMessage[]
      message: string
      requestId: string
    },
    onChunk: (chunk: string) => void
  ): Promise<string> => {
    const channel = `ai:chunk:${args.requestId}`
    const listener = (_e: unknown, chunk: string): void => onChunk(chunk)
    ipcRenderer.on(channel, listener)
    return ipcRenderer.invoke('ai:chat', args).finally(() => {
      ipcRenderer.removeListener(channel, listener)
    })
  }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
```

- [ ] **Step 9: Create renderer ambient typing `src/renderer/api.d.ts`**

```ts
import type { Api } from '../preload/index'

declare global {
  interface Window {
    api: Api
  }
}

export {}
```

- [ ] **Step 10: Verify it compiles and boots**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm run dev` (quit after window appears)
Expected: window opens, no errors in the terminal or devtools console.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add ipc handlers and typed preload bridge"
```

---

## Task 10: Tailwind + shadcn base styling

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`, `src/renderer/lib/utils.ts`, `src/renderer/components/ui/button.tsx`, `src/renderer/components/ui/textarea.tsx`, `src/renderer/components/ui/dialog.tsx`, `src/renderer/components/ui/select.tsx`
- Modify: `src/renderer/index.css`
- Note: install shadcn primitive deps in Step 1.

- [ ] **Step 1: Install shadcn primitive deps**

Run:
```bash
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-slot
```
Expected: installs without error.

- [ ] **Step 2: Create `postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

- [ ] **Step 3: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' }
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
```

- [ ] **Step 4: Replace `src/renderer/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 4%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --primary: 240 6% 10%;
    --primary-foreground: 0 0% 98%;
    --accent: 240 5% 96%;
    --accent-foreground: 240 6% 10%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 6% 90%;
    --input: 240 6% 90%;
    --ring: 240 5% 65%;
    --radius: 0.5rem;
  }
  * { border-color: hsl(var(--border)); }
  html, body, #root { height: 100%; margin: 0; }
  body {
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: system-ui, sans-serif;
  }
}
```

- [ ] **Step 5: Create `src/renderer/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 6: Create `src/renderer/components/ui/button.tsx`**

```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground'
      },
      size: { default: 'h-9 px-4 py-2', sm: 'h-8 px-3 text-xs', icon: 'h-9 w-9' }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'
```

- [ ] **Step 7: Create `src/renderer/components/ui/textarea.tsx`**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
```

- [ ] **Step 8: Create `src/renderer/components/ui/dialog.tsx`**

```tsx
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
))
DialogTitle.displayName = 'DialogTitle'
```

- [ ] **Step 9: Create `src/renderer/components/ui/select.tsx`**

```tsx
import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 overflow-hidden rounded-md border bg-background shadow-md',
        className
      )}
      position="popper"
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'
```

- [ ] **Step 10: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add tailwind config and shadcn base components"
```

---

## Task 11: Renderer state store

**Files:**
- Create: `src/renderer/state/useProject.ts`

- [ ] **Step 1: Create `src/renderer/state/useProject.ts`**

```ts
import { create } from 'zustand'
import type {
  Settings,
  ProjectMeta,
  ChatMessage,
  CompileResult
} from '@shared/types'

interface ProjectState {
  dir: string | null
  meta: ProjectMeta | null
  source: string
  pdfPath: string | null
  pdfVersion: number // bump to force PDF reload
  chat: ChatMessage[]
  settings: Settings
  compiling: boolean
  chatting: boolean
  lastCompile: CompileResult | null

  setSource: (s: string) => void
  loadProject: (p: { dir: string; meta: ProjectMeta; source: string }) => void
  setSettings: (s: Settings) => void
  setChat: (c: ChatMessage[]) => void
  addMessage: (m: ChatMessage) => void
  setCompiling: (b: boolean) => void
  setChatting: (b: boolean) => void
  setCompileResult: (r: CompileResult) => void
}

export const useProject = create<ProjectState>((set) => ({
  dir: null,
  meta: null,
  source: '',
  pdfPath: null,
  pdfVersion: 0,
  chat: [],
  settings: { provider: 'claude', model: '' },
  compiling: false,
  chatting: false,
  lastCompile: null,

  setSource: (s) => set({ source: s }),
  loadProject: (p) =>
    set({
      dir: p.dir,
      meta: p.meta,
      source: p.source,
      chat: p.meta.chatHistory,
      settings: p.meta.settings,
      pdfPath: null,
      lastCompile: null
    }),
  setSettings: (s) => set({ settings: s }),
  setChat: (c) => set({ chat: c }),
  addMessage: (m) => set((st) => ({ chat: [...st.chat, m] })),
  setCompiling: (b) => set({ compiling: b }),
  setChatting: (b) => set({ chatting: b }),
  setCompileResult: (r) =>
    set((st) => ({
      lastCompile: r,
      pdfPath: r.ok ? r.pdfPath ?? null : st.pdfPath,
      pdfVersion: r.ok ? st.pdfVersion + 1 : st.pdfVersion
    }))
}))
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/state/useProject.ts
git commit -m "feat: add renderer project store"
```

---

## Task 12: Editor pane (CodeMirror)

**Files:**
- Create: `src/renderer/components/EditorPane.tsx`

- [ ] **Step 1: Create `src/renderer/components/EditorPane.tsx`**

```tsx
import CodeMirror from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { useProject } from '@/state/useProject'

export function EditorPane() {
  const source = useProject((s) => s.source)
  const setSource = useProject((s) => s.setSource)

  return (
    <div className="h-full overflow-auto">
      <CodeMirror
        value={source}
        height="100%"
        theme="light"
        extensions={[StreamLanguage.define(stex)]}
        onChange={setSource}
        basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Install the legacy modes package**

Run: `npm install @codemirror/legacy-modes @codemirror/language`
Expected: installs without error.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add codemirror editor pane"
```

---

## Task 13: PDF pane (pdf.js)

**Files:**
- Create: `src/renderer/components/PdfPane.tsx`

- [ ] **Step 1: Create `src/renderer/components/PdfPane.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useProject } from '@/state/useProject'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export function PdfPane() {
  const pdfPath = useProject((s) => s.pdfPath)
  const pdfVersion = useProject((s) => s.pdfVersion)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.2)

  useEffect(() => {
    if (!pdfPath || !containerRef.current) return
    let cancelled = false
    const container = containerRef.current
    container.innerHTML = ''

    ;(async () => {
      // file path -> file URL with cache-bust so a recompile reloads
      const url = `file://${pdfPath}?v=${pdfVersion}`
      const doc = await pdfjs.getDocument(url).promise
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return
        const page = await doc.getPage(n)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.className = 'mx-auto my-2 shadow border'
        container.appendChild(canvas)
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pdfPath, pdfVersion, scale])

  return (
    <div className="h-full flex flex-col bg-muted">
      <div className="flex items-center gap-1 border-b px-2 py-1 bg-background">
        <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto">
        {!pdfPath && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Compile to preview the PDF.
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/PdfPane.tsx
git commit -m "feat: add pdf.js viewer pane"
```

---

## Task 14: Error log panel

**Files:**
- Create: `src/renderer/components/ErrorLog.tsx`

- [ ] **Step 1: Create `src/renderer/components/ErrorLog.tsx`**

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useProject } from '@/state/useProject'

export function ErrorLog() {
  const last = useProject((s) => s.lastCompile)
  const [open, setOpen] = useState(false)
  if (!last || last.ok) return null

  return (
    <div className="border-t bg-destructive/5 text-sm">
      <button
        className="flex items-center gap-1 w-full px-3 py-2 text-left text-destructive font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {last.summary}
      </button>
      {open && (
        <pre className="max-h-48 overflow-auto px-3 pb-3 text-xs whitespace-pre-wrap text-muted-foreground">
          {last.log}
        </pre>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ErrorLog.tsx
git commit -m "feat: add compile error log panel"
```

---

## Task 15: Chat pane + AI flow

**Files:**
- Create: `src/renderer/components/ChatPane.tsx`

- [ ] **Step 1: Create `src/renderer/components/ChatPane.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { useProject } from '@/state/useProject'
import { extractLatexBlock } from '@shared/latex'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

let reqCounter = 0

export function ChatPane() {
  const { chat, settings, source, chatting } = useProject()
  const addMessage = useProject((s) => s.addMessage)
  const setSource = useProject((s) => s.setSource)
  const setChatting = useProject((s) => s.setChatting)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [chat, streaming])

  async function send() {
    const message = input.trim()
    if (!message || chatting) return
    setInput('')
    addMessage({ role: 'user', content: message })
    setChatting(true)
    setStreaming('')

    const requestId = `r${++reqCounter}`
    let acc = ''
    try {
      const full = await window.api.chat(
        {
          provider: settings.provider,
          model: settings.model,
          source,
          history: useProject.getState().chat,
          message,
          requestId
        },
        (chunk) => {
          acc += chunk
          setStreaming(acc)
        }
      )
      addMessage({ role: 'assistant', content: full })
      const latex = extractLatexBlock(full)
      if (latex !== null) {
        setSource(latex)
        toast.success('Document updated — compile to preview.')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setStreaming('')
      setChatting(false)
    }
  }

  return (
    <div className="h-full flex flex-col border-t">
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        {chat.length === 0 && !streaming && (
          <p className="text-muted-foreground">Ask the assistant to write or edit your document.</p>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-foreground' : 'text-muted-foreground'}>
            <span className="font-medium">{m.role === 'user' ? 'You' : 'Assistant'}: </span>
            <span className="whitespace-pre-wrap">{m.content}</span>
          </div>
        ))}
        {streaming && (
          <div className="text-muted-foreground">
            <span className="font-medium">Assistant: </span>
            <span className="whitespace-pre-wrap">{streaming}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 p-2 border-t">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Describe the document or change you want…"
          className="min-h-[44px]"
        />
        <Button size="icon" onClick={send} disabled={chatting}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ChatPane.tsx
git commit -m "feat: add chat pane with ai flow"
```

---

## Task 16: Settings dialog

**Files:**
- Create: `src/renderer/components/SettingsDialog.tsx`

- [ ] **Step 1: Create `src/renderer/components/SettingsDialog.tsx`**

```tsx
import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useProject } from '@/state/useProject'
import type { Provider } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export function SettingsDialog() {
  const settings = useProject((s) => s.settings)
  const setSettings = useProject((s) => s.setSettings)
  const [open, setOpen] = useState(false)

  function update(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    window.api.setSettings(next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">AI provider</label>
            <Select value={settings.provider} onValueChange={(v) => update({ provider: v as Provider })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">claude</SelectItem>
                <SelectItem value="codex">codex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Model (optional)</label>
            <Textarea
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder="leave blank for CLI default"
              className="min-h-[40px]"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SettingsDialog.tsx
git commit -m "feat: add settings dialog"
```

---

## Task 17: Top bar (project + compile + settings)

**Files:**
- Create: `src/renderer/components/TopBar.tsx`

- [ ] **Step 1: Create `src/renderer/components/TopBar.tsx`**

```tsx
import { toast } from 'sonner'
import { FolderOpen, FilePlus, Play, Save, Loader2 } from 'lucide-react'
import { useProject } from '@/state/useProject'
import { Button } from '@/components/ui/button'
import { SettingsDialog } from './SettingsDialog'

export function TopBar() {
  const { dir, meta, source, settings, chat, compiling } = useProject()
  const loadProject = useProject((s) => s.loadProject)
  const setCompiling = useProject((s) => s.setCompiling)
  const setCompileResult = useProject((s) => s.setCompileResult)

  async function openProject() {
    const res = await window.api.openProject()
    if (res) loadProject(res)
  }
  async function newProject() {
    const res = await window.api.newProject()
    if (res) loadProject(res)
  }
  async function save() {
    if (!dir || !meta) return
    await window.api.saveProject(dir, { ...meta, chatHistory: chat, settings }, source)
    toast.success('Saved.')
  }
  async function compile() {
    if (!dir || !meta || compiling) return
    setCompiling(true)
    try {
      const result = await window.api.compile(dir, meta.entry, source)
      setCompileResult(result)
      if (result.ok) toast.success('Compiled.')
      else toast.error(result.summary)
    } finally {
      setCompiling(false)
    }
  }

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <span className="text-sm font-semibold">Open Prism</span>
      <span className="text-xs text-muted-foreground truncate max-w-[240px]">
        {dir ?? 'no project'}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={newProject}>
          <FilePlus className="h-4 w-4" /> New
        </Button>
        <Button variant="ghost" size="sm" onClick={openProject}>
          <FolderOpen className="h-4 w-4" /> Open
        </Button>
        <Button variant="ghost" size="sm" onClick={save} disabled={!dir}>
          <Save className="h-4 w-4" /> Save
        </Button>
        <Button size="sm" onClick={compile} disabled={!dir || compiling}>
          {compiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Compile
        </Button>
        <SettingsDialog />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TopBar.tsx
git commit -m "feat: add top bar"
```

---

## Task 18: App shell (layout + keyboard shortcut + settings load)

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Replace `src/renderer/App.tsx`**

```tsx
import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { useProject } from '@/state/useProject'
import { TopBar } from '@/components/TopBar'
import { EditorPane } from '@/components/EditorPane'
import { PdfPane } from '@/components/PdfPane'
import { ChatPane } from '@/components/ChatPane'
import { ErrorLog } from '@/components/ErrorLog'

export default function App() {
  const setSettings = useProject((s) => s.setSettings)
  const dir = useProject((s) => s.dir)
  const meta = useProject((s) => s.meta)
  const source = useProject((s) => s.source)
  const compiling = useProject((s) => s.compiling)
  const setCompiling = useProject((s) => s.setCompiling)
  const setCompileResult = useProject((s) => s.setCompileResult)

  // Load global settings once.
  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [setSettings])

  // Cmd/Ctrl+Enter compiles.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!dir || !meta || compiling) return
        setCompiling(true)
        window.api
          .compile(dir, meta.entry, source)
          .then(setCompileResult)
          .finally(() => setCompiling(false))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dir, meta, source, compiling, setCompiling, setCompileResult])

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={50} minSize={25}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={60} minSize={20}>
              <EditorPane />
            </Panel>
            <PanelResizeHandle className="h-px bg-border" />
            <Panel defaultSize={40} minSize={15}>
              <ChatPane />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="w-px bg-border" />
        <Panel defaultSize={50} minSize={25}>
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <PdfPane />
            </div>
            <ErrorLog />
          </div>
        </Panel>
      </PanelGroup>
      <Toaster position="bottom-right" />
    </div>
  )
}
```

- [ ] **Step 2: Verify full type check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Run all unit tests**

Run: `npm test`
Expected: all suites pass (latex, prompt, tectonicLog).

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
Verify in order:
1. Window opens with empty panes; "no project" in the top bar.
2. Click **New** → pick an empty folder → editor fills with the starter document.
3. Click **Compile** → PDF renders in the right pane showing "Hello from Open Prism."
4. In chat, type "add a section titled Introduction with one sentence" → press Enter → assistant reply streams, editor source updates.
5. Click **Compile** → PDF updates to include the new section.
6. Break the source (delete a `}`), Compile → red error summary appears under the PDF; expanding it shows the log.
7. Click **Save**, close, **Open** the same folder → source and chat history restore.

Expected: all steps behave as described.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: wire app shell layout, shortcuts, settings load"
```

---

## Task 19: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# Open Prism

Open-source desktop clone of ChatGPT's "Prism": describe a document in chat, an
AI writes the LaTeX, you compile it to PDF with Tectonic and iterate. The AI is
reached by spawning your locally installed `claude` or `codex` CLI — no API
keys are stored in the app.

## Requirements

- Node.js 20+
- [Tectonic](https://tectonic-typesetting.github.io) on your `PATH`
- A `claude` and/or `codex` CLI installed and authenticated on your `PATH`

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## How it works

- **Left pane:** CodeMirror LaTeX editor (top) + chat (bottom).
- **Right pane:** pdf.js viewer + a collapsible compile-error log.
- Chat sends your message plus the current source to the CLI; the reply's
  ```latex block replaces the editor content. Compilation is manual (Compile
  button or ⌘/Ctrl+Enter).
- Documents are plain folders: `main.tex`, `assets/`, `build/main.pdf`,
  `.prism.json` (entry, provider/model, chat history).

## License

MIT
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture (Tasks 1, 9), layout (Task 18), compile flow (Tasks 6, 17, 18), AI flow (Tasks 7, 15), project format (Task 8), settings (Tasks 8, 16), error handling (Tasks 6, 14), testing (Tasks 3–5). All spec sections mapped.
- **Type consistency:** `CompileResult`, `OpenProjectResult`, `ProjectMeta`, `Settings`, `ChatMessage`, `Provider` defined in Task 2 and used verbatim downstream. `window.api` surface defined in Task 9 Step 8 matches all renderer call sites (`openProject`, `newProject`, `saveProject`, `compile`, `chat`, `getSettings`, `setSettings`).
- **Known caveat:** `loadProject` resets `chatHistory` from disk; the store's `chat` is persisted on Save via TopBar (`{ ...meta, chatHistory: chat }`). Consistent.
```
