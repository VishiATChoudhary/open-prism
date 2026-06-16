import { useCallback } from 'react'
import { toast } from 'sonner'
import type { CompileResult, FileNode } from '@shared/types'
import { useProject } from '@/state/useProject'

const TEXT_EXT = new Set([
  'tex',
  'bib',
  'cls',
  'sty',
  'bbl',
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'tsv',
  'yml',
  'yaml',
  'log'
])

function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return TEXT_EXT.has(ext)
}

function relativeToProject(dir: string, path: string): string {
  return path.startsWith(`${dir}/`) ? path.slice(dir.length + 1) : path
}

/** File-system operations shared by the explorer, top bar and compile path. */
export function useFiles() {
  const refreshTree = useCallback(async () => {
    const { dir } = useProject.getState()
    if (!dir) return
    try {
      useProject.getState().setTree(await window.api.fileTree(dir))
    } catch (e) {
      toast.error(`Could not read files: ${(e as Error).message}`)
    }
  }, [])

  const openPath = useCallback(async (node: FileNode) => {
    if (node.type !== 'file') return
    if (!isTextFile(node.name)) {
      toast.info(`Can't open ${node.name} in the editor.`)
      return
    }
    const { openFiles, activateTab, openTab } = useProject.getState()
    if (openFiles.some((f) => f.path === node.path)) {
      activateTab(node.path)
      return
    }
    try {
      const content = await window.api.readFile(node.path)
      openTab({ path: node.path, content })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])

  /** Persist every dirty open tab to disk, then mark them clean. */
  const writeAllDirty = useCallback(async () => {
    const { openFiles, markAllSaved } = useProject.getState()
    const dirty = openFiles.filter((f) => f.dirty)
    await Promise.all(dirty.map((f) => window.api.writeFile(f.path, f.content)))
    if (dirty.length) markAllSaved()
  }, [])

  const createEntry = useCallback(
    async (parentDir: string, name: string, isDir: boolean) => {
      const clean = name.trim()
      if (!clean) return
      const path = `${parentDir}/${clean}`
      try {
        await window.api.createEntry(path, isDir)
        await refreshTree()
        if (!isDir && isTextFile(clean)) {
          await openPath({ name: clean, path, type: 'file' })
        }
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [refreshTree, openPath]
  )

  const deleteEntry = useCallback(
    async (node: FileNode) => {
      try {
        await window.api.deleteEntry(node.path)
        // close any open tabs under the deleted path
        const { openFiles, closeTab } = useProject.getState()
        openFiles
          .filter((f) => f.path === node.path || f.path.startsWith(node.path + '/'))
          .forEach((f) => closeTab(f.path))
        await refreshTree()
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [refreshTree]
  )

  const renameEntry = useCallback(
    async (node: FileNode, nextName: string) => {
      const clean = nextName.trim()
      if (!clean || clean === node.name) return
      try {
        const newPath = await window.api.renameEntry(node.path, clean)
        const { renameOpen, meta, dir, entryPath, setEntry } = useProject.getState()
        renameOpen(node.path, newPath)
        // keep meta.entry in sync if the main file itself was renamed
        if (entryPath === node.path && meta && dir) {
          const rel = newPath.startsWith(dir + '/') ? newPath.slice(dir.length + 1) : newPath
          setEntry(rel, newPath)
          await window.api.saveMeta(dir, { ...meta, entry: rel })
        }
        await refreshTree()
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [refreshTree]
  )

  const moveEntry = useCallback(
    async (node: FileNode, targetDir: string) => {
      if (node.path === targetDir || targetDir.startsWith(`${node.path}/`)) return
      try {
        const oldEntryPath = useProject.getState().entryPath
        const newPath = await window.api.moveEntry(node.path, targetDir)
        const { renameOpen, meta, dir, setEntry } = useProject.getState()
        renameOpen(node.path, newPath)

        if (oldEntryPath && (oldEntryPath === node.path || oldEntryPath.startsWith(`${node.path}/`)) && meta && dir) {
          const nextEntryPath =
            oldEntryPath === node.path ? newPath : `${newPath}${oldEntryPath.slice(node.path.length)}`
          const rel = relativeToProject(dir, nextEntryPath)
          setEntry(rel, nextEntryPath)
          await window.api.saveMeta(dir, { ...meta, entry: rel })
        }

        await refreshTree()
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [refreshTree]
  )

  const copyExternalEntries = useCallback(
    async (paths: string[], targetDir: string) => {
      if (paths.length === 0) return
      try {
        await window.api.copyExternalEntries(paths, targetDir)
        await refreshTree()
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [refreshTree]
  )

  const setMain = useCallback(async (node: FileNode) => {
    const { dir, meta, setEntry } = useProject.getState()
    if (!dir || !meta || node.type !== 'file') return
    const rel = node.path.startsWith(dir + '/') ? node.path.slice(dir.length + 1) : node.path
    setEntry(rel, node.path)
    try {
      await window.api.saveMeta(dir, { ...meta, entry: rel })
      toast.success(`${node.name} is now the main file.`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])

  /** Persist edits, then compile the project's main entry with Tectonic. */
  const compileProject = useCallback(async (): Promise<CompileResult | null> => {
    const { dir, meta, compiling, setCompiling, setCompileResult } = useProject.getState()
    if (!dir || !meta || compiling) return null
    setCompiling(true)
    try {
      await writeAllDirty()
      const result = await window.api.compile(dir, meta.entry)
      setCompileResult(result)
      return result
    } finally {
      useProject.getState().setCompiling(false)
    }
  }, [writeAllDirty])

  return {
    refreshTree,
    openPath,
    writeAllDirty,
    createEntry,
    deleteEntry,
    renameEntry,
    moveEntry,
    copyExternalEntries,
    setMain,
    compileProject
  }
}
