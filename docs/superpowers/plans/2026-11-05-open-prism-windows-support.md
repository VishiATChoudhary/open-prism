# Windows Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows 10/11 x64 runtime support and an unsigned NSIS + portable ZIP build, without changing macOS behavior.

**Architecture:** Platform-adaptive process spawning (`cross-spawn` + Windows PATH merge), pure-JS ZIP import (`fflate`), POSIX-normalized project entries, and electron-builder Windows targets. Five agents work in isolated worktrees on disjoint files; an integrator merges and regenerates the lockfile.

**Tech Stack:** Electron 31, electron-vite, React 18, TypeScript 5.5, Vitest 2, `cross-spawn`, `fflate`, `electron-builder` 25, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-11-05-open-prism-windows-support-design.md`](../specs/2026-11-05-open-prism-windows-support-design.md)

---

## Execution Model

### Branches and worktrees

Create the integration branch first, commit the docs, then branch every agent from the same commit:

```bash
git switch -c windows/integration
git add docs/superpowers/specs/2026-11-05-open-prism-windows-support-design.md \
        docs/superpowers/plans/2026-11-05-open-prism-windows-support.md \
        docs/windows-port-effort-analysis.md
git commit -m "docs: add Windows support spec and plan"

git worktree add ../open-prism-a1 -b windows/a1-process windows/integration
git worktree add ../open-prism-a2 -b windows/a2-project windows/integration
git worktree add ../open-prism-a3 -b windows/a3-packaging windows/integration
git worktree add ../open-prism-a4 -b windows/a4-ci windows/integration
git worktree add ../open-prism-a5 -b windows/a5-docs windows/integration
```

Do **not** commit the untracked `pnpm-lock.yaml` or `pnpm-workspace.yaml`. npm is the package manager.

### Frozen interfaces

| Interface | Value |
|---|---|
| Windows build | `npm run package:win` |
| NSIS artifact | `dist/Open-Prism-<version>-win-x64.exe` |
| Portable artifact | `dist/Open-Prism-<version>-win-x64.zip` |
| macOS build | `npm run package:mac` (unchanged) |
| `resolveSpawnEnv()` | `Promise<NodeJS.ProcessEnv>` |
| `importProjectZip(zipPath, settings)` | `Promise<OpenProjectResult>` |

### File ownership

| Agent | May edit |
|---|---|
| A1 | `src/main/services/spawnEnv.ts`, `src/main/services/aiCli.ts`, `src/main/services/tectonic.ts`, `tests/spawnEnv.test.ts`, `tests/aiCli.test.ts`, dependency entries in `package.json` |
| A2 | `src/main/services/projectStore.ts`, `src/main/services/zip.ts`, `src/main/services/projectPaths.ts`, `tests/projectStore.test.ts`, `tests/zip.test.ts`, `tests/projectPaths.test.ts`, dependency entries in `package.json` |
| A3 | `package.json` (scripts, metadata, electron-builder dep), `electron-builder.yml` |
| A4 | `.github/workflows/release.yml` |
| A5 | `README.md` |
| A6 | Integration only: merge commits, `package.json` reconciliation, `package-lock.json` |

A1, A2, and A3 may only add their own dependency entries to `package.json`. A6 is the only agent allowed to reconcile conflicts or edit scripts/metadata from another agent.

### Agent dispatch prompt template

Use this prompt for every Wave 1 agent, substituting the agent ID, worktree path, task numbers, and file list:

```text
You are agent A<N> for the Open Prism Windows port.

Worktree: <absolute path>
Branch: windows/a<N>-<name>
Read first:
- docs/superpowers/specs/2026-11-05-open-prism-windows-support-design.md
- docs/superpowers/plans/2026-11-05-open-prism-windows-support.md (your task numbers)

Scope: edit ONLY these files: <file list>. Do not edit any other file.

Follow the plan task-by-task with TDD:
1. Write the failing test.
2. Run it and confirm the expected failure.
3. Implement the minimal change.
4. Run the test and the full suite.
5. Commit with the message specified in the task.

Do not use `shell: true` when spawning external processes.
Do not add or commit pnpm files.
Do not merge, rebase, or touch the integration branch.

Return: files changed, commands run, test output summary, commit SHA, blockers.
```

### Wave timeline

| Wave | Agents | Parallel? | Est. wall-clock |
|---|---|---|---|
| 0 | Orchestrator | — | 10 min |
| 1 | A1, A2, A3, A4, A5 | Yes | 6–8 h |
| 2 | A6 → A7 → A8 | Sequential | 6–10 h |
| **Total** | | | **~1–1.5 days** |

Critical path: **A3 → A6 → A7**.

### Human checkpoints

- Approve this plan before dispatching Wave 1.
- Confirm Tectonic is installed on the Windows machine before Task 10.
- Accept the installed application after Task 10 (SmartScreen, shortcuts, icon).

---

# Wave 1 — Parallel Implementation

## Task 1 (A1): Build a platform-correct PATH

**Files:**
- Modify: `src/main/services/spawnEnv.ts`
- Create: `tests/spawnEnv.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/spawnEnv.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildSpawnPath } from '../src/main/services/spawnEnv'

describe('buildSpawnPath', () => {
  it('merges Windows dirs with semicolons and case-insensitive dedupe', () => {
    const result = buildSpawnPath({
      platform: 'win32',
      envPath: 'C:\\Windows;C:\\Tools;c:\\tools',
      home: 'C:\\Users\\me',
      env: {
        APPDATA: 'C:\\Users\\me\\AppData\\Roaming',
        ProgramData: 'C:\\ProgramData'
      }
    })

    expect(result.split(';')).toEqual([
      'C:\\Windows',
      'C:\\Tools',
      'C:\\Users\\me\\.local\\bin',
      'C:\\Users\\me\\AppData\\Roaming\\npm',
      'C:\\Users\\me\\.cargo\\bin',
      'C:\\Users\\me\\scoop\\shims',
      'C:\\ProgramData\\chocolatey\\bin'
    ])
  })

  it('keeps the POSIX login-shell PATH first and uses colons', () => {
    const result = buildSpawnPath({
      platform: 'darwin',
      envPath: '/usr/bin:/bin',
      home: '/Users/me',
      env: {},
      loginShellPath: '/opt/homebrew/bin:/usr/local/bin'
    })

    expect(result.split(':').slice(0, 4)).toEqual([
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin'
    ])
    expect(result).toContain('/Users/me/.local/bin')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/spawnEnv.test.ts`

Expected: FAIL — `buildSpawnPath` is not exported.

- [ ] **Step 3: Implement the PATH builder**

Replace `src/main/services/spawnEnv.ts` with:

```ts
import { spawn } from 'child_process'
import { homedir } from 'os'
import { posix, win32 } from 'path'

let cached: NodeJS.ProcessEnv | null = null

interface PathInput {
  platform: NodeJS.Platform
  envPath: string
  home: string
  env: NodeJS.ProcessEnv
  loginShellPath?: string
}

/** Read the user's real PATH from their login shell (empty string on failure). */
function loginShellPath(): Promise<string> {
  return new Promise((resolve) => {
    const shell = process.env.SHELL || '/bin/zsh'
    try {
      const proc = spawn(shell, ['-lc', 'echo "$PATH"'], { stdio: ['ignore', 'pipe', 'ignore'] })
      let out = ''
      proc.stdout.on('data', (d) => (out += d.toString()))
      proc.on('error', () => resolve(''))
      proc.on('close', () => resolve(out.trim()))
    } catch {
      resolve('')
    }
  })
}

function knownSpawnDirs(
  platform: NodeJS.Platform,
  home: string,
  env: NodeJS.ProcessEnv
): string[] {
  if (platform === 'win32') {
    const p = win32
    const dirs = [p.join(home, '.local', 'bin')]
    if (env.APPDATA) dirs.push(p.join(env.APPDATA, 'npm'))
    dirs.push(p.join(home, '.cargo', 'bin'), p.join(home, 'scoop', 'shims'))
    if (env.ProgramData) dirs.push(p.join(env.ProgramData, 'chocolatey', 'bin'))
    return dirs
  }

  const p = posix
  return [
    p.join(home, '.superset', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    p.join(home, '.local', 'bin'),
    p.join(home, '.cargo', 'bin'),
    p.join(home, 'bin')
  ]
}

/**
 * Merge the login-shell PATH (POSIX), the inherited PATH, and known install
 * directories into one platform-correct PATH string.
 */
export function buildSpawnPath(input: PathInput): string {
  const sep = input.platform === 'win32' ? ';' : ':'
  const parts = [
    input.loginShellPath ?? '',
    input.envPath,
    ...knownSpawnDirs(input.platform, input.home, input.env)
  ]
  const seen = new Set<string>()
  const merged: string[] = []

  for (const part of parts) {
    for (const dir of part.split(sep)) {
      if (!dir) continue
      const key = input.platform === 'win32' ? dir.toLowerCase() : dir
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(dir)
    }
  }

  return merged.join(sep)
}

/**
 * Build the environment used to spawn external CLIs (claude, codex, tectonic).
 *
 * GUI apps inherit a minimal PATH. On macOS that omits Homebrew and
 * ~/.local/bin; on Windows it can omit the native Claude installer directory,
 * npm global shims, Scoop, Chocolatey, or cargo. Merge all of them once.
 */
export async function resolveSpawnEnv(): Promise<NodeJS.ProcessEnv> {
  if (cached) return cached
  const home = homedir()
  const shellPath = process.platform === 'win32' ? '' : await loginShellPath()

  cached = {
    ...process.env,
    PATH: buildSpawnPath({
      platform: process.platform,
      envPath: process.env.PATH ?? '',
      home,
      env: process.env,
      loginShellPath: shellPath
    })
  }
  return cached
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/spawnEnv.test.ts`

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/spawnEnv.ts tests/spawnEnv.test.ts
git commit -m "feat: build a platform-correct spawn PATH"
```

---

## Task 2 (A1): Spawn CLIs through cross-spawn

**Files:**
- Modify: `src/main/services/aiCli.ts:1`, `src/main/services/aiCli.ts:76-78`, `src/main/services/tectonic.ts:1`, `src/main/services/tectonic.ts:36-42`
- Modify: `tests/aiCli.test.ts`
- Modify: `package.json` (dependency entries only)

- [ ] **Step 1: Install the dependency**

```bash
npm install "cross-spawn@^7.0.6"
npm install -D "@types/cross-spawn@^6.0.6"
```

Expected: `package.json` gains `cross-spawn` under `dependencies` and `@types/cross-spawn` under `devDependencies`.

- [ ] **Step 2: Write the failing test**

First replace the two existing imports at the top of `tests/aiCli.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { filterAiCliNoise } from '../src/main/services/aiCli'
```

with:

```ts
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filterAiCliNoise, runAiCli } from '../src/main/services/aiCli'
```

Do not add a second `vitest` import. Then append this block to the end of the file:

```ts
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock('cross-spawn', () => ({ default: spawnMock }))
vi.mock('../src/main/services/spawnEnv', () => ({
  resolveSpawnEnv: async () => process.env
}))

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }
}

function fakeChild(): FakeChild {
  const proc = new EventEmitter() as FakeChild
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = { write: vi.fn(), end: vi.fn() }
  return proc
}

describe('runAiCli spawning', () => {
  beforeEach(() => spawnMock.mockReset())

  it('spawns without a shell and pipes the prompt to stdin', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)

    const result = runAiCli('claude', '', 'hello', () => {})
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalled())

    child.stdout.emit('data', Buffer.from('answer'))
    child.emit('close', 0)

    await expect(result).resolves.toBe('answer')
    expect(spawnMock).toHaveBeenCalledWith(
      'claude',
      ['-p'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    )
    expect(spawnMock.mock.calls[0]?.[2]).not.toHaveProperty('shell', true)
    expect(child.stdin.write).toHaveBeenCalledWith('hello')
    expect(child.stdin.end).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/aiCli.test.ts`

Expected: FAIL — `spawnMock` is never called because `aiCli.ts` still uses `child_process.spawn`.

- [ ] **Step 4: Switch to cross-spawn and improve the error**

In `src/main/services/aiCli.ts`, replace:

```ts
import { spawn } from 'child_process'
```

with:

```ts
import spawn from 'cross-spawn'
```

Then replace the `proc.on('error', ...)` handler:

```ts
    proc.on('error', (e) =>
      reject(new Error(`Failed to start "${bin}": ${e.message}. Is the CLI installed and on PATH?`))
    )
```

with:

```ts
    proc.on('error', (e) =>
      reject(
        new Error(
          `Failed to start "${bin}": ${e.message}. Install it and ensure it is on PATH. ` +
            'Claude: https://docs.claude.com/en/docs/claude-code — ' +
            'Codex: https://developers.openai.com/codex/cli'
        )
      )
    )
```

In `src/main/services/tectonic.ts`, replace:

```ts
import { spawn } from 'child_process'
```

with:

```ts
import spawn from 'cross-spawn'
```

Then replace the compile error summary:

```ts
        summary: 'Tectonic not found. Install it: https://tectonic-typesetting.github.io'
```

with:

```ts
        summary:
          'Tectonic not found. Install it with Scoop, Chocolatey, or cargo, ' +
          'or see https://tectonic-typesetting.github.io'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/aiCli.test.ts tests/spawnEnv.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/aiCli.ts src/main/services/tectonic.ts tests/aiCli.test.ts package.json package-lock.json
git commit -m "feat: spawn external CLIs through cross-spawn"
```

---

## Task 3 (A2): Add a pure-JS ZIP service

**Files:**
- Create: `src/main/services/zip.ts`
- Create: `tests/zip.test.ts`
- Modify: `package.json` (dependency entries only)

- [ ] **Step 1: Install the dependency**

```bash
npm install "fflate@^0.8.3"
```

Expected: `fflate` appears under `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `tests/zip.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { extractZip, readZip, validateZipEntries } from '../src/main/services/zip'

const cleanup: string[] = []

async function makeZip(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'open-prism-zip-'))
  cleanup.push(dir)
  const zipPath = join(dir, 'fixture.zip')
  const payload = Object.fromEntries(
    Object.entries(files).map(([name, body]) => [name, strToU8(body)])
  )
  await writeFile(zipPath, zipSync(payload))
  return zipPath
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('zip import', () => {
  it('reads nested entries and skips macOS metadata', async () => {
    const zipPath = await makeZip({
      'paper/main.tex': 'hello',
      'paper/assets/figure.txt': 'asset',
      '__MACOSX/._main.tex': 'junk',
      'paper/.DS_Store': 'junk'
    })

    const files = await readZip(zipPath)

    expect([...files.keys()].sort()).toEqual(['paper/assets/figure.txt', 'paper/main.tex'])
  })

  it('extracts files into the target directory', async () => {
    const zipPath = await makeZip({ 'paper/main.tex': 'hello' })
    const target = await mkdtemp(join(tmpdir(), 'open-prism-unzip-'))
    cleanup.push(target)

    await extractZip(zipPath, target)

    expect(await readFile(join(target, 'paper', 'main.tex'), 'utf8')).toBe('hello')
  })

  it('rejects unsafe entries', () => {
    expect(() => validateZipEntries(['../escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['/tmp/escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['paper\\escape.tex'])).toThrow('unsafe')
    expect(() => validateZipEntries(['C:/escape.tex'])).toThrow('unsafe')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/zip.test.ts`

Expected: FAIL — `src/main/services/zip.ts` does not exist.

- [ ] **Step 4: Implement the ZIP service**

Create `src/main/services/zip.ts`:

```ts
import { promises as fs } from 'fs'
import { dirname, join, posix } from 'path'
import { unzipSync } from 'fflate'

/** Reject absolute paths, drive letters, backslashes, and any `..` segment. */
export function validateZipEntries(entries: string[]): void {
  for (const entry of entries) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    if (
      trimmed.startsWith('/') ||
      trimmed.includes('\\') ||
      /^[A-Za-z]:/.test(trimmed) ||
      trimmed.split('/').includes('..') ||
      posix.normalize(trimmed).startsWith('../') ||
      posix.normalize(trimmed) === '..' ||
      posix.normalize(trimmed).includes('/../')
    ) {
      throw new Error('Zip archive contains unsafe paths.')
    }
  }
}

function isMetadataEntry(name: string): boolean {
  return (
    name.endsWith('/') ||
    name === '__MACOSX' ||
    name.startsWith('__MACOSX/') ||
    name.endsWith('.DS_Store')
  )
}

/** Read a ZIP into memory, filtering macOS metadata and validating paths. */
export async function readZip(zipPath: string): Promise<Map<string, Uint8Array>> {
  const buffer = new Uint8Array(await fs.readFile(zipPath))
  const extracted = unzipSync(buffer)
  const files = new Map<string, Uint8Array>()

  for (const [name, data] of Object.entries(extracted)) {
    if (isMetadataEntry(name)) continue
    files.set(name, data)
  }

  validateZipEntries([...files.keys()])
  return files
}

/** Extract a validated ZIP into targetDir and return the written entry names. */
export async function extractZip(zipPath: string, targetDir: string): Promise<string[]> {
  const files = await readZip(zipPath)

  for (const [name, data] of files) {
    const destination = join(targetDir, ...name.split('/'))
    await fs.mkdir(dirname(destination), { recursive: true })
    await fs.writeFile(destination, data)
  }

  return [...files.keys()]
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/zip.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/zip.ts tests/zip.test.ts package.json package-lock.json
git commit -m "feat: replace unzip with a pure-JS zip service"
```

---

## Task 4 (A2): Add portable project-path helpers

**Files:**
- Create: `src/main/services/projectPaths.ts`
- Create: `tests/projectPaths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/projectPaths.test.ts`:

```ts
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertWindowsSafeName,
  normalizeEntryPath,
  toPosixRelative
} from '../src/main/services/projectPaths'

describe('project path portability', () => {
  it('normalizes Windows entry separators', () => {
    expect(normalizeEntryPath('chapters\\intro.tex')).toBe('chapters/intro.tex')
  })

  it('returns a forward-slash relative path', () => {
    const root = join('root')
    expect(toPosixRelative(root, join(root, 'chapters', 'intro.tex'))).toBe(
      'chapters/intro.tex'
    )
  })

  it('rejects Windows reserved names and trailing dots', () => {
    expect(() => assertWindowsSafeName('CON')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('con.tex')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('COM1')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('notes.')).toThrow('not a valid name')
    expect(() => assertWindowsSafeName('main.tex')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/projectPaths.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/main/services/projectPaths.ts`:

```ts
import { relative, sep } from 'node:path'

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** Store project entries with `/` so projects are portable across operating systems. */
export function toPosixRelative(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join('/')
}

/** Normalize legacy Windows separators read from `.prism.json`. */
export function normalizeEntryPath(entry: string): string {
  return entry.replace(/\\/g, '/')
}

/** Reject names Windows cannot represent reliably. */
export function assertWindowsSafeName(name: string): void {
  if (!name || /[.\s]$/.test(name) || WINDOWS_RESERVED.test(name)) {
    throw new Error(`"${name}" is not a valid name on Windows.`)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/projectPaths.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/projectPaths.ts tests/projectPaths.test.ts
git commit -m "feat: add portable project path helpers"
```

---

## Task 5 (A2): Integrate ZIP and path helpers into the project store

**Files:**
- Modify: `src/main/services/projectStore.ts:1-3`, `:35-49`, `:61-84`, `:91-107`, `:127-147`, `:237-280`
- Modify: `tests/projectStore.test.ts:1-2`

- [ ] **Step 1: Update the existing test import**

The validation function moved to `zip.ts`. Change the `validateZipEntries` import in `tests/projectStore.test.ts`:

```ts
import { validateZipEntries } from '../src/main/services/projectStore'
```

to:

```ts
import { validateZipEntries } from '../src/main/services/zip'
```

- [ ] **Step 2: Run the tests to verify the current state**

Run: `npx vitest run tests/projectStore.test.ts tests/zip.test.ts`

Expected: the updated import passes with the Task 3 implementation; the suite is green before the refactor.

- [ ] **Step 3: Replace imports and remove the shell-out**

At the top of `src/main/services/projectStore.ts`, replace:

```ts
import { spawn } from 'child_process'
import { homedir, tmpdir } from 'os'
import { basename, extname, join, posix, relative, sep } from 'path'
import { promises as fs } from 'fs'
```

with:

```ts
import { homedir, tmpdir } from 'os'
import { basename, extname, join, relative, sep } from 'path'
import { promises as fs } from 'fs'
import { extractZip } from './zip'
import { assertWindowsSafeName, normalizeEntryPath, toPosixRelative } from './projectPaths'
```

Delete the `runCommand` function (lines 35–49). It is replaced by `extractZip`.

Delete the local `validateZipEntries` function (lines 91–107). It now lives in `./zip`.

- [ ] **Step 4: Harden project and entry naming**

Replace `slugifyProjectName`:

```ts
function slugifyProjectName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w .-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  )
}
```

with:

```ts
function slugifyProjectName(name: string): string {
  const base =
    name
      .trim()
      .replace(/[^\w .-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[.\s]+$/g, '')
      .replace(/^-+|-+$/g, '') || 'untitled'
  assertWindowsSafeName(base)
  return base
}
```

Replace the cleaning block in `normalizeEntryName`:

```ts
  const cleaned = trimmed
    .replace(/[^\w .-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') throw new Error('File name is invalid.')
  return cleaned.endsWith('.tex') ? cleaned : `${cleaned}.tex`
```

with:

```ts
  const cleaned = trimmed
    .replace(/[^\w .-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[.\s]+$/g, '')
    .replace(/^-+|-+$/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') throw new Error('File name is invalid.')
  assertWindowsSafeName(cleaned)
  return cleaned.endsWith('.tex') ? cleaned : `${cleaned}.tex`
```

- [ ] **Step 5: Normalize entry paths**

Replace `normalizeProjectMeta`:

```ts
function normalizeProjectMeta(meta: ProjectMeta, fallbackSettings: Settings): ProjectMeta {
  return {
    ...meta,
    settings: normalizeSettings(meta.settings, fallbackSettings)
  }
}
```

with:

```ts
function normalizeProjectMeta(meta: ProjectMeta, fallbackSettings: Settings): ProjectMeta {
  const entry = typeof meta.entry === 'string' && meta.entry.trim() ? meta.entry : 'main.tex'
  return {
    ...meta,
    entry: normalizeEntryPath(entry),
    settings: normalizeSettings(meta.settings, fallbackSettings)
  }
}
```

Replace the return in `findTexEntry`:

```ts
    if (stat.isFile() && name.endsWith('.tex')) return relative(root, path)
```

with:

```ts
    if (stat.isFile() && name.endsWith('.tex')) return toPosixRelative(root, path)
```

- [ ] **Step 6: Use extractZip in importProjectZip**

Replace the beginning of `importProjectZip`:

```ts
export async function importProjectZip(
  zipPath: string,
  settings: Settings
): Promise<OpenProjectResult> {
  const entries = (await runCommand('unzip', ['-Z', '-1', zipPath]))
    .split(/\r?\n/)
    .filter(Boolean)
  validateZipEntries(entries)

  const tempDir = await fs.mkdtemp(join(tmpdir(), 'open-prism-import-'))
  let targetDir: string | null = null

  try {
    await runCommand('unzip', ['-q', zipPath, '-d', tempDir])
```

with:

```ts
export async function importProjectZip(
  zipPath: string,
  settings: Settings
): Promise<OpenProjectResult> {
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'open-prism-import-'))
  let targetDir: string | null = null

  try {
    await extractZip(zipPath, tempDir)
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`

Expected: PASS — all existing tests plus the new ZIP and path tests.

- [ ] **Step 8: Commit**

```bash
git add src/main/services/projectStore.ts tests/projectStore.test.ts
git commit -m "feat: import projects without external unzip"
```

---

## Task 6 (A3): Add electron-builder Windows packaging

**Files:**
- Modify: `package.json` (scripts, author, devDependency)
- Create: `electron-builder.yml`

- [ ] **Step 1: Install electron-builder**

```bash
npm install -D "electron-builder@^25.1.8"
```

Expected: `electron-builder` appears under `devDependencies`.

- [ ] **Step 2: Add scripts and metadata to package.json**

Add an `author` field after `"license"`:

```json
  "author": "Open Prism contributors",
```

Add the Windows script after `"package:mac"`:

```json
    "package:win": "npm run build && electron-builder --win --x64 --publish never",
```

- [ ] **Step 3: Create electron-builder.yml**

Create `electron-builder.yml`:

```yaml
appId: dev.openprism.app
productName: Open Prism
directories:
  output: dist
  buildResources: resources
files:
  - out/**/*
  - resources/**/*
  - package.json
asar: true
win:
  icon: resources/app-icon.png
  artifactName: Open-Prism-${version}-win-${arch}.${ext}
  target:
    - target: nsis
      arch: [x64]
    - target: zip
      arch: [x64]
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

- [ ] **Step 4: Verify the app builds and packs**

Run:

```bash
npm run build
npx electron-builder --dir --win --x64
```

Expected: `dist/win-unpacked/Open Prism.exe` exists and the command exits 0.

If the packaged app reports a preload error or a missing icon, add
`asarUnpack: ["out/preload/**", "resources/**"]` to `electron-builder.yml` and
rerun. This is the approved fallback from the spec.

- [ ] **Step 5: Verify the asar contains the app and icon**

Run:

```bash
npx --yes @electron/asar list dist/win-unpacked/resources/app.asar | grep -Ei "out.main|out.preload|resources.app-icon.png" | head -10
```

Expected: paths for `out/main/index.js` and `resources/app-icon.png`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json electron-builder.yml
git commit -m "build: add electron-builder Windows targets"
```

---

## Task 7 (A4): Add Windows to the release workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Replace the workflow**

Replace `.github/workflows/release.yml` with:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - runner: macos-15   # Apple Silicon (arm64)
            arch: arm64
            package_cmd: package:mac
            artifacts: dist/*.dmg
          - runner: macos-15-intel   # Intel (x64)
            arch: x64
            package_cmd: package:mac
            artifacts: dist/*.dmg
          - runner: windows-latest
            arch: x64
            package_cmd: package:win
            artifacts: |
              dist/*.exe
              dist/*.zip
    runs-on: ${{ matrix.runner }}
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Test
        run: npm test

      - name: Package
        run: npm run ${{ matrix.package_cmd }}

      - name: Upload artifacts to release
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: ${{ matrix.artifacts }}
          fail_on_unmatched_files: true
          generate_release_notes: true

      - name: Upload workflow artifacts
        if: github.event_name == 'workflow_dispatch'
        uses: actions/upload-artifact@v4
        with:
          name: open-prism-${{ matrix.arch }}-${{ runner.os }}
          path: ${{ matrix.artifacts }}
          if-no-files-found: error
```

- [ ] **Step 2: Validate the YAML**

Run: `npx --yes js-yaml .github/workflows/release.yml`

Expected: valid YAML printed to stdout, exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add Windows build to the release workflow"
```

---

## Task 8 (A5): Document Windows support

**Files:**
- Modify: `README.md:11-21`, `:57-70`, `:79-91`, `:95-118`

- [ ] **Step 1: Add the Windows download badge**

In the badge block, after the macOS badge, add:

```html
  <a href="https://github.com/VishiATChoudhary/open-prism/releases/latest">
    <img alt="Download for Windows" src="https://img.shields.io/badge/Download-Windows%20x64-2f81f7?style=for-the-badge&logo=windows&logoColor=white" />
  </a>
```

- [ ] **Step 2: Update the Download section**

Replace:

```markdown
Get the latest macOS build from the
[Releases page](https://github.com/VishiATChoudhary/open-prism/releases/latest).

The current packaged app is ad-hoc signed and not Apple-notarized. On first
launch, macOS may require you to right-click the app and choose **Open**.
```

with:

```markdown
Get the latest build from the
[Releases page](https://github.com/VishiATChoudhary/open-prism/releases/latest).

- macOS DMG (Apple Silicon and Intel)
- Windows x64 installer and portable ZIP

The macOS app is ad-hoc signed and not Apple-notarized. On first launch, macOS
may require you to right-click the app and choose **Open**.

The Windows installer is currently unsigned, so SmartScreen may show
"Unknown publisher". Choose **More info → Run anyway**.
```

- [ ] **Step 3: Update Requirements**

Replace:

```markdown
- macOS for the packaged desktop app
- The [`claude` CLI](https://docs.claude.com/en/docs/claude-code) installed, authenticated, and on your `PATH` (or `codex` as an alternative)
- [Tectonic](https://tectonic-typesetting.github.io) available on your `PATH`
- Node.js 20+ if you are developing locally
```

with:

```markdown
- macOS 12+ for the macOS app, or Windows 10/11 x64 for the Windows app
- The [`claude` CLI](https://docs.claude.com/en/docs/claude-code) installed, authenticated, and on your `PATH` (or `codex` as an alternative)
- [Tectonic](https://tectonic-typesetting.github.io) available on your `PATH`
  - Windows: `scoop install tectonic`, `choco install tectonic`, `cargo install tectonic`, or the official installer
- Node.js 20+ if you are developing locally
```

- [ ] **Step 4: Update Build**

Replace:

````markdown
Create a macOS DMG:

```bash
npm run package:mac
```

The generated installer is written to `dist/`.
````

with:

````markdown
Create a macOS DMG:

```bash
npm run package:mac
```

Create the Windows installer and portable ZIP:

```bash
npm run package:win
```

The generated artifacts are written to `dist/`:
`Open-Prism-<version>-win-x64.exe` (NSIS) and
`Open-Prism-<version>-win-x64.zip` (portable).
````

- [ ] **Step 5: Update the project shape note**

Replace:

```markdown
Open Prism stores projects in `~/.openprism`. Each project is a plain folder
with your source files, assets, build output, and a `.prism.json` metadata file.
```

with:

```markdown
Open Prism stores projects in `~/.openprism` (`C:\Users\<you>\.openprism` on
Windows). Each project is a plain folder with your source files, assets, build
output, and a `.prism.json` metadata file.
```

- [ ] **Step 6: Verify the docs**

Run:

```bash
grep -n "package:win" README.md
grep -n "Windows 10/11" README.md
```

Expected: both commands print matching lines.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: document Windows installation and builds"
```

---

# Wave 2 — Integration and QA

## Task 9 (A6): Integrate the five worktrees

**Files:**
- Merge only; final conflict resolution in `package.json` and `package-lock.json`

- [ ] **Step 1: Confirm every agent is committed**

```bash
git worktree list
git log --oneline windows/a1-process windows/a2-project windows/a3-packaging windows/a4-ci windows/a5-docs -1
```

Expected: five branches, each with at least one commit beyond `windows/integration`.

- [ ] **Step 2: Merge in dependency order**

```bash
git switch windows/integration
git merge --no-ff windows/a3-packaging -m "merge: Windows packaging"
git merge --no-ff windows/a1-process -m "merge: Windows process layer"
git merge --no-ff windows/a2-project -m "merge: Windows project store"
git merge --no-ff windows/a4-ci -m "merge: Windows CI"
git merge --no-ff windows/a5-docs -m "merge: Windows docs"
```

- [ ] **Step 3: Resolve package.json conflicts by union**

The final `package.json` must contain all of the following:

```json
  "author": "Open Prism contributors",
  "scripts": {
    "package:win": "npm run build && electron-builder --win --x64 --publish never"
  },
  "dependencies": {
    "cross-spawn": "^7.0.6",
    "fflate": "^0.8.3"
  },
  "devDependencies": {
    "@types/cross-spawn": "^6.0.6",
    "electron-builder": "^25.1.8"
  }
```

Keep every other dependency and script from the original file.

- [ ] **Step 4: Regenerate the lockfile**

```bash
rm -f package-lock.json
npm install
```

Expected: `package-lock.json` is recreated with no errors.

- [ ] **Step 5: Run the full verification**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: typecheck passes, all tests pass, build succeeds.

- [ ] **Step 6: Build the real Windows artifacts**

```bash
npm run package:win
ls dist
```

Expected in `dist/`:
- `Open-Prism-0.1.0-win-x64.exe`
- `Open-Prism-0.1.0-win-x64.zip`
- `win-unpacked/`

The first run may download NSIS tooling; allow network access.

- [ ] **Step 7: Verify production dependencies are packaged**

```bash
npx --yes @electron/asar list dist/win-unpacked/resources/app.asar | grep -Ei "node_modules.(cross-spawn|fflate)" | head -10
```

Expected: at least one path for `cross-spawn` and one for `fflate`.

- [ ] **Step 8: Commit the integration**

```bash
git add package.json package-lock.json
git commit -m "build: reconcile Windows dependencies"
```

- [ ] **Step 9: Remove the agent worktrees**

```bash
git worktree remove ../open-prism-a1
git worktree remove ../open-prism-a2
git worktree remove ../open-prism-a3
git worktree remove ../open-prism-a4
git worktree remove ../open-prism-a5
```

Expected: worktrees removed; branches remain available until the PR is merged.

---

## Task 10 (A7): Windows QA

**Files:** none (manual and command-line verification)

- [ ] **Step 1: Install Tectonic**

```powershell
scoop install tectonic
# or, in an elevated shell:
choco install tectonic -y
# or download a release from https://github.com/tectonic-typesetting/tectonic/releases
```

Verify:

```powershell
tectonic --version
```

Expected: a version string, exit 0.

- [ ] **Step 2: Run the app from source**

```bash
npm run dev
```

Expected: the window opens; no preload or renderer errors in DevTools.

- [ ] **Step 3: Run the functional checklist**

- [ ] Create a project, edit `main.tex`, save, return home, reopen it.
- [ ] Rename the project and a file; delete a project.
- [ ] Compile with Tectonic; confirm the PDF preview renders.
- [ ] Export the PDF; confirm it appears in the Windows Downloads folder.
- [ ] Chat with the native CLI at `%USERPROFILE%\.local\bin\claude.exe`.
- [ ] Chat with an npm-style `claude.cmd` shim (see Step 4).
- [ ] Chat with `codex`, if installed.
- [ ] Import a Windows-created ZIP.
- [ ] Import a macOS-created ZIP containing `__MACOSX`.
- [ ] Import a ZIP containing `../escape.tex`; confirm a clear rejection.

- [ ] **Step 4: Verify `.cmd` shim resolution deterministically**

In PowerShell:

```powershell
$dir = Join-Path $env:TEMP 'open-prism-cli-test'
New-Item -ItemType Directory -Force $dir | Out-Null
Set-Content -Path (Join-Path $dir 'fake-cli.cmd') -Value "@echo off`r`necho fake-cli-ok`r`n" -NoNewline
$env:PATH = "$dir;$env:PATH"
node -e "const s=require('cross-spawn');const p=s('fake-cli',[],{stdio:['ignore','pipe','pipe']});let o='';p.stdout.on('data',d=>o+=d);p.on('close',c=>console.log(c,o.trim()))"
```

Expected: `0 fake-cli-ok`. This proves `cross-spawn` resolves `.cmd` shims on Windows.

- [ ] **Step 5: Create ZIP fixtures**

Windows-created ZIP:

```powershell
$fixture = Join-Path $env:TEMP 'open-prism-fixture'
New-Item -ItemType Directory -Force (Join-Path $fixture 'paper') | Out-Null
Set-Content -Path (Join-Path $fixture 'paper\main.tex') -Value '\documentclass{article}\begin{document}Hi\end{document}'
tar -a -c -f (Join-Path $env:TEMP 'fixture-win.zip') -C $fixture .
```

macOS-style ZIP:

```bash
node -e "const {zipSync,strToU8}=require('fflate');const fs=require('fs');fs.writeFileSync('fixture-mac.zip',zipSync({'__MACOSX/._main.tex':strToU8('junk'),'paper/main.tex':strToU8('\\\\documentclass{article}')}))"
```

Unsafe ZIP:

```bash
node -e "const {zipSync,strToU8}=require('fflate');const fs=require('fs');fs.writeFileSync('fixture-unsafe.zip',zipSync({'../escape.tex':strToU8('x')}))"
```

- [ ] **Step 6: Install and test the packaged app**

```powershell
.\dist\Open-Prism-0.1.0-win-x64.exe
```

Install per-user (no admin), then verify:

- [ ] Start-menu shortcut exists.
- [ ] Desktop shortcut is created (if selected in the installer).
- [ ] The taskbar/window icon is the Open Prism icon.
- [ ] The app launches and the checklist from Step 3 passes in the packaged app.
- [ ] Uninstall from Settings removes the app and shortcuts.

- [ ] **Step 7: Test the portable ZIP**

Extract `dist/Open-Prism-0.1.0-win-x64.zip` to a new directory, run `Open Prism.exe` from a non-admin account, and repeat a compile + PDF export.

- [ ] **Step 8: Record results**

Write the QA result in the PR description: each checklist item, pass/fail, and the Windows version used. Do not edit source files in this task.

---

## Task 11 (A8): Adversarial review and final acceptance

**Files:** none

- [ ] **Step 1: Review the diff against the spec**

```bash
git diff main...windows/integration -- . ':!package-lock.json'
```

Check each item:

- [ ] No `shell: true` anywhere in `src/`.
- [ ] No reference to an `unzip` binary remains.
- [ ] `spawnEnv.ts` has no POSIX-only branch executing on Windows.
- [ ] `meta.entry` is stored with `/`.
- [ ] Electron-builder artifact names match the frozen contract.
- [ ] macOS workflow entries are unchanged in behavior.

- [ ] **Step 2: Search for the anti-patterns**

```bash
git grep -n "shell: true" -- src || echo "no shell:true"
git grep -n "unzip" -- src || echo "no unzip"
git grep -n "process.platform" -- src
```

Expected: no `shell: true`, no `unzip`; `process.platform` appears only in the platform-aware spawn code and the existing window-lifecycle check.

- [ ] **Step 3: Run the final suite**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin windows/integration
gh pr create --base main --head windows/integration \
  --title "Windows support: runtime, packaging, and release" \
  --body "Implements docs/superpowers/specs/2026-11-05-open-prism-windows-support-design.md. Includes Windows runtime support, electron-builder NSIS + portable builds, CI, docs, and QA results."
```

Expected: PR created with the QA checklist from Task 10 in the body.

---

## Self-Review Checklist

- [ ] Every spec section maps to a task:
  - 5.1 contracts → Execution Model + Tasks 6, 7
  - 5.2 process layer → Tasks 1, 2
  - 5.3 ZIP → Tasks 3, 5
  - 5.4 paths → Tasks 4, 5
  - 5.5 packaging → Task 6
  - 5.6 CI → Task 7
  - 5.7 docs → Task 8
  - 6 parallel execution → Execution Model + Tasks 9–11
  - 7 testing → Tasks 1–5, 9, 10
- [ ] No placeholders remain.
- [ ] Type and function names match across tasks: `buildSpawnPath`, `readZip`, `extractZip`, `validateZipEntries`, `toPosixRelative`, `normalizeEntryPath`, `assertWindowsSafeName`.
- [ ] Artifact names match the contract everywhere.
