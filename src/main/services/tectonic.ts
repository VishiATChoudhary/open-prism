import { spawn } from 'child_process'
import { join, basename } from 'path'
import { promises as fs } from 'fs'
import type { CompileResult } from '../../shared/types'
import { summarizeTectonicLog } from '../../shared/tectonicLog'
import { resolveSpawnEnv } from './spawnEnv'

/**
 * Compiles an entry .tex with Tectonic into <projectDir>/build. The entry and
 * any \input/\bibliography files are read from disk as-is, so callers must
 * persist unsaved editor buffers before invoking this.
 */
export async function compile(projectDir: string, entry: string): Promise<CompileResult> {
  const entryPath = join(projectDir, entry)
  const buildDir = join(projectDir, 'build')
  await fs.mkdir(buildDir, { recursive: true })
  const env = await resolveSpawnEnv()

  return new Promise<CompileResult>((resolve) => {
    const proc = spawn('tectonic', ['--outdir', buildDir, '--keep-logs', entryPath], {
      cwd: projectDir,
      env
    })
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
        summary: 'Tectonic not found. Install it: https://tectonic-typesetting.github.io'
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
