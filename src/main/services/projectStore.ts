import { spawn } from 'child_process'
import { homedir, tmpdir } from 'os'
import { basename, extname, join, posix, relative, sep } from 'path'
import { promises as fs } from 'fs'
import type {
  ProjectHome,
  ProjectMeta,
  ProjectSummary,
  RenameProjectEntryResult,
  OpenProjectResult,
  Settings
} from '../../shared/types'
import { normalizeSettings } from '../../shared/settings'

const META_FILE = '.prism.json'
const ROOT_DIR = '.openprism'

const STARTER_TEX = `\\documentclass{article}
\\begin{document}
Hello from Open Prism.
\\end{document}
`

function defaultMeta(settings: Settings): ProjectMeta {
  return { entry: 'main.tex', settings: normalizeSettings(settings), chatHistory: [] }
}

function normalizeProjectMeta(meta: ProjectMeta, fallbackSettings: Settings): ProjectMeta {
  return {
    ...meta,
    settings: normalizeSettings(meta.settings, fallbackSettings)
  }
}

function runCommand(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''

    proc.stdout.on('data', (d) => (out += d.toString()))
    proc.stderr.on('data', (d) => (err += d.toString()))
    proc.on('error', (error) => reject(new Error(`Failed to start "${bin}": ${error.message}`)))
    proc.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err.trim() || `"${bin}" exited with code ${code}`))
    })
  })
}

export function openPrismRoot(): string {
  return join(homedir(), ROOT_DIR)
}

export async function ensureOpenPrismRoot(): Promise<string> {
  const root = openPrismRoot()
  await fs.mkdir(root, { recursive: true })
  return root
}

function slugifyProjectName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w .-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  )
}

function normalizeEntryName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('File name is required.')
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(sep)) {
    throw new Error('File name cannot include folders.')
  }

  const cleaned = trimmed
    .replace(/[^\w .-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') throw new Error('File name is invalid.')
  return cleaned.endsWith('.tex') ? cleaned : `${cleaned}.tex`
}

function zipProjectName(zipPath: string): string {
  const name = basename(zipPath)
  return extname(name).toLowerCase() === '.zip' ? name.slice(0, -4) : name
}

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

async function visibleDirEntries(dir: string): Promise<string[]> {
  const names = await fs.readdir(dir)
  return names.filter((name) => name !== '__MACOSX' && name !== '.DS_Store')
}

async function importRootForExtractedDir(dir: string): Promise<string> {
  const names = await visibleDirEntries(dir)
  if (names.length !== 1) return dir

  const candidate = join(dir, names[0])
  try {
    if ((await fs.stat(candidate)).isDirectory()) return candidate
  } catch {
    return dir
  }
  return dir
}

async function findTexEntry(dir: string, root = dir): Promise<string | null> {
  const names = await fs.readdir(dir)
  const sorted = names.sort((a, b) => {
    if (a === 'main.tex') return -1
    if (b === 'main.tex') return 1
    return a.localeCompare(b)
  })

  for (const name of sorted) {
    if (name === '__MACOSX' || name === '.DS_Store' || name === 'build' || name === '.git') continue
    const path = join(dir, name)
    const stat = await fs.stat(path)
    if (stat.isFile() && name.endsWith('.tex')) return relative(root, path)
    if (stat.isDirectory()) {
      const nested = await findTexEntry(path, root)
      if (nested) return nested
    }
  }

  return null
}

async function uniqueProjectDir(name: string): Promise<string> {
  const root = await ensureOpenPrismRoot()
  const base = slugifyProjectName(name)
  let candidate = join(root, base)
  let suffix = 2
  while (true) {
    try {
      await fs.access(candidate)
      candidate = join(root, `${base}-${suffix}`)
      suffix += 1
    } catch {
      return candidate
    }
  }
}

async function readMeta(dir: string, settings: Settings): Promise<ProjectMeta> {
  try {
    const meta = {
      ...defaultMeta(settings),
      ...JSON.parse(await fs.readFile(join(dir, META_FILE), 'utf8'))
    }
    return normalizeProjectMeta(meta, settings)
  } catch {
    return defaultMeta(settings)
  }
}

async function summarizeProject(dir: string, settings: Settings): Promise<ProjectSummary | null> {
  try {
    const stat = await fs.stat(dir)
    if (!stat.isDirectory()) return null
    const meta = await readMeta(dir, settings)
    const updatedAt = await latestMtime([
      dir,
      join(dir, META_FILE),
      join(dir, meta.entry)
    ])
    return {
      name: basename(dir),
      dir,
      entry: meta.entry,
      updatedAt
    }
  } catch {
    return null
  }
}

async function latestMtime(paths: string[]): Promise<number> {
  const times = await Promise.all(
    paths.map(async (path) => {
      try {
        return (await fs.stat(path)).mtimeMs
      } catch {
        return 0
      }
    })
  )
  return Math.max(...times)
}

export async function listProjects(settings: Settings): Promise<ProjectHome> {
  const rootDir = await ensureOpenPrismRoot()
  const names = await fs.readdir(rootDir)
  const summaries = await Promise.all(
    names.map((name) => summarizeProject(join(rootDir, name), settings))
  )
  return {
    rootDir,
    projects: summaries
      .filter((project): project is ProjectSummary => project !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }
}

async function scaffoldProject(dir: string, settings: Settings): Promise<OpenProjectResult> {
  await fs.mkdir(join(dir, 'assets'), { recursive: true })
  const meta = defaultMeta(settings)
  await fs.writeFile(join(dir, meta.entry), STARTER_TEX, 'utf8')
  await fs.writeFile(join(dir, META_FILE), JSON.stringify(meta, null, 2), 'utf8')
  return { dir, meta, source: STARTER_TEX }
}

export async function newProject(name: string, settings: Settings): Promise<OpenProjectResult> {
  return scaffoldProject(await uniqueProjectDir(name), settings)
}

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
    const sourceRoot = await importRootForExtractedDir(tempDir)
    targetDir = await uniqueProjectDir(basename(sourceRoot) === basename(tempDir) ? zipProjectName(zipPath) : basename(sourceRoot))

    await fs.cp(sourceRoot, targetDir, {
      recursive: true,
      filter: (src) => {
        const parts = relative(sourceRoot, src).split(sep)
        return !parts.includes('__MACOSX') && !parts.includes('.DS_Store')
      }
    })

    let meta = await readMeta(targetDir, settings)
    try {
      await fs.access(join(targetDir, meta.entry))
    } catch {
      const entry = await findTexEntry(targetDir)
      if (!entry) throw new Error('No .tex file found in zip archive.')
      meta = { ...meta, entry }
    }

    await fs.writeFile(join(targetDir, META_FILE), JSON.stringify(meta, null, 2), 'utf8')
    const source = await fs.readFile(join(targetDir, meta.entry), 'utf8')
    return { dir: targetDir, meta, source }
  } catch (error) {
    if (targetDir) await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {})
    throw error
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function renameProject(
  dir: string,
  nextName: string,
  settings: Settings
): Promise<ProjectSummary> {
  const root = await ensureOpenPrismRoot()
  if (dir !== root && !dir.startsWith(root + sep)) {
    throw new Error('Invalid project directory.')
  }

  const base = slugifyProjectName(nextName)
  if (base === basename(dir)) {
    const summary = await summarizeProject(dir, settings)
    if (!summary) throw new Error('Project not found.')
    return summary
  }

  const target = await uniqueProjectDir(nextName)
  await fs.rename(dir, target)
  const summary = await summarizeProject(target, settings)
  if (!summary) throw new Error('Rename failed.')
  return summary
}

export async function deleteProject(dir: string): Promise<void> {
  const root = await ensureOpenPrismRoot()
  if (dir === root || !dir.startsWith(root + sep)) {
    throw new Error('Invalid project directory.')
  }

  const stat = await fs.stat(dir)
  if (!stat.isDirectory()) throw new Error('Project not found.')
  await fs.rm(dir, { recursive: true, force: false })
}

export async function openProject(dir: string, settings: Settings): Promise<OpenProjectResult> {
  const meta = await readMeta(dir, settings)
  let source = ''
  try {
    source = await fs.readFile(join(dir, meta.entry), 'utf8')
  } catch {
    source = STARTER_TEX
  }
  return { dir, meta, source }
}

export async function saveProject(dir: string, meta: ProjectMeta, source: string): Promise<void> {
  await fs.writeFile(join(dir, meta.entry), source, 'utf8')
  await fs.writeFile(join(dir, META_FILE), JSON.stringify(normalizeProjectMeta(meta, meta.settings), null, 2), 'utf8')
}

/** Persist project metadata (entry, settings, chat) without touching file content. */
export async function saveMeta(dir: string, meta: ProjectMeta): Promise<void> {
  await fs.writeFile(join(dir, META_FILE), JSON.stringify(normalizeProjectMeta(meta, meta.settings), null, 2), 'utf8')
}

export async function renameProjectEntry(
  dir: string,
  meta: ProjectMeta,
  source: string,
  nextEntry: string
): Promise<RenameProjectEntryResult> {
  const entry = normalizeEntryName(nextEntry)
  if (entry === meta.entry) {
    await saveProject(dir, meta, source)
    return { meta, source }
  }

  const from = join(dir, meta.entry)
  const to = join(dir, entry)
  try {
    await fs.access(to)
    throw new Error('A file with that name already exists.')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  try {
    await fs.rename(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await fs.writeFile(to, source, 'utf8')
  }

  const nextMeta = { ...meta, entry }
  await fs.writeFile(to, source, 'utf8')
  await fs.writeFile(join(dir, META_FILE), JSON.stringify(nextMeta, null, 2), 'utf8')
  return { meta: nextMeta, source }
}
