import { promises as fs } from 'fs'
import { basename, dirname, join, sep } from 'path'
import { openPrismRoot } from './projectStore'
import type { FileNode } from '../../shared/types'

/** Directories never shown in the project explorer. */
const IGNORE_DIRS = new Set(['build', '.git', 'node_modules', '.cache'])
const IGNORE_FILES = new Set(['.prism.json', '.DS_Store'])

function assertInsideRoot(p: string): void {
  const root = openPrismRoot()
  if (p !== root && !p.startsWith(root + sep)) {
    throw new Error('Path is outside the Open Prism workspace.')
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function assertDirectory(path: string): Promise<void> {
  const stat = await fs.stat(path)
  if (!stat.isDirectory()) throw new Error('Drop target is not a folder.')
}

export async function readTree(dir: string): Promise<FileNode[]> {
  assertInsideRoot(dir)
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes = await Promise.all(
    entries
      .filter((e) => (e.isDirectory() ? !IGNORE_DIRS.has(e.name) : !IGNORE_FILES.has(e.name)))
      .map(async (e): Promise<FileNode> => {
        const full = join(dir, e.name)
        if (e.isDirectory()) {
          return { name: e.name, path: full, type: 'dir', children: await readTree(full) }
        }
        return { name: e.name, path: full, type: 'file' }
      })
  )

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/** Create an empty file or a directory. Fails if the path already exists. */
export async function createEntry(path: string, isDir: boolean): Promise<void> {
  assertInsideRoot(path)
  if (await exists(path)) throw new Error('A file or folder with that name already exists.')
  if (isDir) {
    await fs.mkdir(path, { recursive: true })
  } else {
    await fs.mkdir(dirname(path), { recursive: true })
    await fs.writeFile(path, '', 'utf8')
  }
}

export async function deleteEntry(path: string): Promise<void> {
  assertInsideRoot(path)
  await fs.rm(path, { recursive: true, force: false })
}

/** Rename within the same parent directory. Returns the new absolute path. */
export async function renameEntry(path: string, nextName: string): Promise<string> {
  assertInsideRoot(path)
  const clean = nextName.trim()
  if (!clean || clean.includes('/') || clean.includes(sep)) {
    throw new Error('Name cannot be empty or contain folders.')
  }
  const target = join(dirname(path), clean)
  assertInsideRoot(target)
  if (basename(path) === clean) return path
  if (await exists(target)) throw new Error('A file or folder with that name already exists.')
  await fs.rename(path, target)
  return target
}

/** Move a file/folder into a target directory. Returns the new absolute path. */
export async function moveEntry(path: string, targetDir: string): Promise<string> {
  assertInsideRoot(path)
  assertInsideRoot(targetDir)
  await assertDirectory(targetDir)

  const target = join(targetDir, basename(path))
  assertInsideRoot(target)
  if (target === path) return path
  if (target.startsWith(path + sep)) throw new Error('Cannot move a folder into itself.')
  if (await exists(target)) throw new Error('A file or folder with that name already exists.')
  await fs.rename(path, target)
  return target
}

/** Copy dropped OS files/folders into a project directory. */
export async function copyExternalEntries(paths: string[], targetDir: string): Promise<void> {
  assertInsideRoot(targetDir)
  await assertDirectory(targetDir)

  for (const path of paths) {
    const target = join(targetDir, basename(path))
    assertInsideRoot(target)
    if (await exists(target)) throw new Error(`A file or folder named ${basename(path)} already exists.`)
    await fs.cp(path, target, { recursive: true })
  }
}
