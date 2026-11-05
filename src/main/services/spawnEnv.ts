import { spawn } from 'child_process'
import { accessSync, constants as fsConstants, readdirSync, statSync } from 'fs'
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

const DEFAULT_PATHEXT = ['.COM', '.EXE', '.BAT', '.CMD']

/** PATHEXT extensions, normalized to start with a dot. */
function pathextExtensions(env: NodeJS.ProcessEnv): string[] {
  const configured = (env.PATHEXT ?? '')
    .split(';')
    .map((ext) => ext.trim())
    .filter(Boolean)
  const extensions = configured.length > 0 ? configured : DEFAULT_PATHEXT
  return extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`))
}

/**
 * Look for `bin` inside one PATH directory. Windows matches case-insensitively
 * (both the PATHEXT extension and the file name); POSIX additionally requires
 * the file to be executable.
 */
function findExecutableInDir(
  dir: string,
  bin: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): string | null {
  if (platform === 'win32') {
    const names = win32.extname(bin)
      ? [bin]
      : pathextExtensions(env).map((ext) => `${bin}${ext}`)

    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return null
    }

    const actualByLower = new Map<string, string>()
    for (const entry of entries) {
      const key = entry.toLowerCase()
      if (!actualByLower.has(key)) actualByLower.set(key, entry)
    }

    for (const name of names) {
      const actual = actualByLower.get(name.toLowerCase())
      if (!actual) continue
      const candidate = win32.join(dir, actual)
      try {
        if (statSync(candidate).isFile()) return candidate
      } catch {
        // Unreadable entry: keep scanning the remaining candidates.
      }
    }
    return null
  }

  const candidate = posix.join(dir, bin)
  try {
    if (!statSync(candidate).isFile()) return null
    accessSync(candidate, fsConstants.X_OK)
    return candidate
  } catch {
    return null
  }
}

/**
 * Resolve `bin` to an absolute path by scanning PATH. Returns null when no
 * matching file exists.
 *
 * Only absolute directory entries are considered: a project-local
 * `tectonic.cmd` (or `.` on POSIX) must never shadow the real CLI when `cwd`
 * is an untrusted project directory. Relative and empty entries are skipped.
 */
export function resolveExecutable(
  bin: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform
): string | null {
  if (!bin) return null

  const separator = platform === 'win32' ? ';' : ':'
  const isAbsolute = platform === 'win32' ? win32.isAbsolute : posix.isAbsolute
  const pathValue = env.PATH ?? env.Path ?? ''

  for (const rawEntry of pathValue.split(separator)) {
    // PATH entries are sometimes quoted ("C:\Program Files\...").
    const entry = rawEntry.trim().replace(/^"(.*)"$/, '$1')
    if (!entry || !isAbsolute(entry)) continue

    const resolved = findExecutableInDir(entry, bin, env, platform)
    if (resolved) return resolved
  }

  return null
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
