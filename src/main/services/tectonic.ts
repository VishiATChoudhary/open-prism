import spawn from 'cross-spawn'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { join, basename } from 'path'
import { promises as fs } from 'fs'
import type { CompileResult } from '../../shared/types'
import { summarizeTectonicLog } from '../../shared/tectonicLog'
import { resolveExecutable, resolveSpawnEnv } from './spawnEnv'

/**
 * Compiles an entry .tex with Tectonic into <projectDir>/build. The entry and
 * any \input/\bibliography files are read from disk as-is, so callers must
 * persist unsaved editor buffers before invoking this.
 */
export async function compile(projectDir: string, entry: string): Promise<CompileResult> {
  const env = await resolveSpawnEnv()
  // Resolve against PATH ourselves so a project-local tectonic executable
  // cannot shadow the real one when compiling untrusted projects. Fail closed:
  // never hand cross-spawn a bare name that it could resolve from the cwd.
  const executable = resolveExecutable('tectonic', env)
  if (!executable) {
    return {
      ok: false,
      log: 'Tectonic was not found on PATH.',
      summary:
        'Tectonic not found. Install it and ensure it is on PATH: ' +
        'https://tectonic-typesetting.github.io'
    }
  }

  const entryPath = join(projectDir, entry)
  const buildDir = join(projectDir, 'build')
  await fs.mkdir(buildDir, { recursive: true })

  return new Promise<CompileResult>((resolve) => {
    const proc = spawn(executable, ['--outdir', buildDir, '--keep-logs', entryPath], {
      cwd: projectDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    }) as ChildProcessWithoutNullStreams
    let settled = false
    let log = ''

    function settle(result: CompileResult): void {
      if (settled) return
      settled = true
      resolve(result)
    }

    proc.stdout.on('data', (d) => (log += d.toString()))
    proc.stderr.on('data', (d) => (log += d.toString()))

    proc.on('error', (err) => {
      settle({
        ok: false,
        log: `Failed to start tectonic: ${err.message}`,
        summary:
          'Tectonic not found. Install it and ensure it is on PATH: ' +
          'https://tectonic-typesetting.github.io'
      })
    })

    proc.on('close', (code) => {
      if (settled) return
      if (code === 0) {
        const pdfName = basename(entry).replace(/\.tex$/, '.pdf')
        settle({ ok: true, pdfPath: join(buildDir, pdfName), log, summary: '' })
      } else {
        settle({ ok: false, log, summary: summarizeTectonicLog(log) })
      }
    })
  })
}
