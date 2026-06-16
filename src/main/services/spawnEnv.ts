import { spawn } from 'child_process'
import { homedir } from 'os'

let cached: NodeJS.ProcessEnv | null = null

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

/**
 * Build the environment used to spawn external CLIs (claude, codex, tectonic).
 *
 * GUI apps launched from Finder/dock inherit a minimal PATH that omits things
 * like ~/.superset/bin, ~/.local/bin or Homebrew — so a CLI that works in the
 * terminal fails with ENOENT in the packaged app. We merge the login shell's
 * PATH with a set of common install dirs and cache the result.
 */
export async function resolveSpawnEnv(): Promise<NodeJS.ProcessEnv> {
  if (cached) return cached
  const home = homedir()
  const known = [
    `${home}/.superset/bin`,
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    `${home}/.local/bin`,
    `${home}/.cargo/bin`,
    `${home}/bin`
  ]
  const shellPath = await loginShellPath()
  const seen = new Set<string>()
  const merged = [shellPath, process.env.PATH ?? '', ...known]
    .flatMap((p) => p.split(':'))
    .filter((d) => d && !seen.has(d) && (seen.add(d), true))
    .join(':')

  cached = { ...process.env, PATH: merged }
  return cached
}
