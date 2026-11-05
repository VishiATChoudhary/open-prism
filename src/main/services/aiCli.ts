import spawn from 'cross-spawn'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import type { Provider } from '../../shared/types'
import { resolveExecutable, resolveSpawnEnv } from './spawnEnv'

const NODE_CIRCULAR_WARNING_RE =
  /^\(node:\d+\) Warning: Accessing non-existent property '(lineno|filename)' of module exports inside circular dependency(?: \(Use `node --trace-warnings \.\.\.` to show where the warning was created\))?$/

function isCliNoiseLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    NODE_CIRCULAR_WARNING_RE.test(trimmed) ||
    trimmed === '(Use `node --trace-warnings ...` to show where the warning was created)'
  )
}

function installHint(provider: Provider): string {
  return provider === 'claude'
    ? 'Claude: https://docs.claude.com/en/docs/claude-code'
    : 'Codex: https://developers.openai.com/codex/cli'
}

export function filterAiCliNoise(text: string): string {
  const hasTrailingNewline = /\r?\n$/.test(text)
  const lines = text.split(/\r?\n/)
  if (hasTrailingNewline) lines.pop()

  const filtered = lines.filter((line) => !isCliNoiseLine(line))
  if (filtered.length === 0) return ''

  return `${filtered.join('\n')}${hasTrailingNewline ? '\n' : ''}`
}

/**
 * Spawns the configured AI CLI with the prompt on stdin and streams progress to
 * onChunk. Resolves with the final assistant text (stdout) on success.
 *
 * Codex writes its live progress to stderr and only flushes the final message
 * to stdout at the end, so we stream BOTH to onChunk for a responsive log but
 * resolve with stdout alone — that is the clean answer used for LaTeX extraction.
 */
export async function runAiCli(
  provider: Provider,
  model: string,
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  let bin: string
  let args: string[]
  if (provider === 'claude') {
    bin = 'claude'
    args = ['-p']
    if (model) args.push('--model', model)
  } else {
    // OpenAI Codex CLI, non-interactive. Reads the prompt from stdin
    // (`-`), no ANSI codes so latex extraction stays clean, read-only sandbox
    // since we only want text back, no persisted session files.
    bin = 'codex'
    args = ['exec', '--color', 'never', '--skip-git-repo-check', '-s', 'read-only', '--ephemeral']
    if (model) args.push('-m', model)
    args.push('-')
  }

  const env = await resolveSpawnEnv()
  // Resolve against PATH ourselves so cross-spawn cannot pick up a
  // project-local executable when cwd contains untrusted files. Fail closed:
  // never hand cross-spawn a bare name that it could resolve from the cwd.
  const executable = resolveExecutable(bin, env)
  if (!executable) {
    const label = provider === 'claude' ? 'Claude CLI' : 'Codex CLI'
    throw new Error(
      `${label} ("${bin}") was not found on PATH. ` +
        `Install it and ensure it is on PATH. ${installHint(provider)}`
    )
  }

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(executable, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    }) as ChildProcessWithoutNullStreams
    let out = ''
    let err = ''

    // A child that exits before reading stdin (e.g. a missing .cmd shim on
    // Windows) makes write() fail with EPIPE. Without a listener that 'error'
    // event is unhandled and would crash the Electron main process.
    proc.stdin.on('error', () => {})

    proc.stdout.on('data', (d) => {
      const s = d.toString()
      out += s
      onChunk(s)
    })
    proc.stderr.on('data', (d) => {
      const s = filterAiCliNoise(d.toString())
      if (!s) return
      err += s
      onChunk(s)
    })

    proc.on('error', (e) => {
      reject(
        new Error(
          `Failed to start "${bin}": ${e.message}. Install it and ensure it is on PATH. ${installHint(provider)}`
        )
      )
    })
    proc.on('close', (code) => {
      // Prefer stdout (the clean final message); fall back to stderr if a CLI
      // emitted its answer there instead.
      if (code === 0) resolve(out.trim() ? out : err)
      else reject(new Error(err || `"${bin}" exited with code ${code}`))
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}
