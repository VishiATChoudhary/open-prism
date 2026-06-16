import { useEffect, useState, type DragEvent } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus,
  FolderPlus,
  Pencil,
  RotateCw,
  Star,
  Trash2
} from 'lucide-react'
import type { FileNode } from '@shared/types'
import { cn } from '@/lib/utils'
import { useProject } from '@/state/useProject'
import { useFiles } from '@/state/useFiles'

interface NewEntry {
  parent: string
  kind: 'file' | 'dir'
}

export function FileTree() {
  const dir = useProject((s) => s.dir)
  const tree = useProject((s) => s.tree)
  const entryPath = useProject((s) => s.entryPath)
  const activePath = useProject((s) => s.activePath)
  const openFiles = useProject((s) => s.openFiles)
  const {
    refreshTree,
    openPath,
    createEntry,
    deleteEntry,
    renameEntry,
    moveEntry,
    copyExternalEntries,
    setMain
  } = useFiles()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [newEntry, setNewEntry] = useState<NewEntry | null>(null)
  const [newName, setNewName] = useState('')
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  useEffect(() => {
    void refreshTree()
  }, [dir, refreshTree])

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  function startNew(parent: string, kind: 'file' | 'dir') {
    if (parent !== dir) setExpanded((p) => new Set(p).add(parent))
    setNewEntry({ parent, kind })
    setNewName('')
  }

  async function commitNew() {
    if (!newEntry) return
    await createEntry(newEntry.parent, newName, newEntry.kind === 'dir')
    setNewEntry(null)
    setNewName('')
  }

  const dirtyPaths = new Set(openFiles.filter((f) => f.dirty).map((f) => f.path))

  function nameFromPath(path: string) {
    return path.split('/').filter(Boolean).pop() ?? path
  }

  function droppedExternalPaths(e: DragEvent) {
    return Array.from(e.dataTransfer.files)
      .map((file) => window.api.droppedFilePath(file) || (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path))
  }

  function draggedProjectPath(e: DragEvent) {
    return e.dataTransfer.getData('application/x-open-prism-path') || draggingPath
  }

  function canDropProjectPath(path: string | null, targetDir: string) {
    if (!path) return true
    return path !== targetDir && !targetDir.startsWith(`${path}/`)
  }

  function handleDragOver(e: DragEvent, targetDir: string) {
    const hasExternalFiles = Array.from(e.dataTransfer.types).includes('Files')
    const projectPath = draggingPath
    if (!hasExternalFiles && !projectPath) return
    if (!canDropProjectPath(projectPath, targetDir)) return

    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move'
    setDropTarget(targetDir)
  }

  function handleDragLeave(e: DragEvent, targetDir: string) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDropTarget((current) => (current === targetDir ? null : current))
  }

  async function handleDrop(e: DragEvent, targetDir: string) {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)

    const externalPaths = droppedExternalPaths(e)
    if (externalPaths.length > 0) {
      await copyExternalEntries(externalPaths, targetDir)
      return
    }

    const projectPath = draggedProjectPath(e)
    if (!projectPath || !canDropProjectPath(projectPath, targetDir)) return
    await moveEntry({ name: nameFromPath(projectPath), path: projectPath, type: 'file' }, targetDir)
    if (targetDir !== dir) setExpanded((prev) => new Set(prev).add(targetDir))
  }

  function renderNewInput(parent: string, depth: number) {
    if (!newEntry || newEntry.parent !== parent) return null
    return (
      <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: 8 + depth * 12 }}>
        {newEntry.kind === 'dir' ? (
          <FolderPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <FilePlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={() => void commitNew()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitNew()
            if (e.key === 'Escape') {
              setNewEntry(null)
              setNewName('')
            }
          }}
          placeholder={newEntry.kind === 'dir' ? 'folder name' : 'file.tex'}
          className="h-6 min-w-0 flex-1 rounded border border-border/80 bg-background/60 px-1.5 text-[12px] text-foreground outline-none focus:border-spectral-1/40"
        />
      </div>
    )
  }

  function renderNodes(nodes: FileNode[], depth: number) {
    return nodes.map((node) => {
      const isDir = node.type === 'dir'
      const isOpen = expanded.has(node.path)
      const isActive = node.path === activePath
      const isMain = node.path === entryPath
      const isRenaming = renamingPath === node.path
      const indent = 8 + depth * 12
      const targetDir = isDir ? node.path : node.path.split('/').slice(0, -1).join('/')
      const isDropTarget = dropTarget === (isDir ? node.path : null)

      return (
        <div key={node.path}>
          <div
            draggable={!isRenaming}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('application/x-open-prism-path', node.path)
              e.dataTransfer.setData('text/plain', node.path)
              setDraggingPath(node.path)
            }}
            onDragEnd={() => {
              setDraggingPath(null)
              setDropTarget(null)
            }}
            onDragOver={(e) => handleDragOver(e, targetDir)}
            onDragLeave={(e) => handleDragLeave(e, targetDir)}
            onDrop={(e) => handleDrop(e, targetDir)}
            className={cn(
              'group flex items-center gap-1 rounded-md py-1 pr-1.5 text-[12.5px]',
              isActive ? 'bg-spectral-1/15 text-foreground' : 'text-muted-foreground hover:bg-accent',
              draggingPath === node.path && 'opacity-45',
              isDropTarget && 'bg-spectral-3/15 text-foreground ring-1 ring-spectral-3/35'
            )}
            style={{ paddingLeft: indent }}
          >
            {isDir ? (
              <button onClick={() => toggle(node.path)} className="shrink-0">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <File className="h-3.5 w-3.5 shrink-0 opacity-70" />
            )}

            {isRenaming ? (
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => {
                  void renameEntry(node, renameDraft)
                  setRenamingPath(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void renameEntry(node, renameDraft)
                    setRenamingPath(null)
                  }
                  if (e.key === 'Escape') setRenamingPath(null)
                }}
                className="h-6 min-w-0 flex-1 rounded border border-border/80 bg-background/60 px-1.5 text-[12px] text-foreground outline-none focus:border-spectral-1/40"
              />
            ) : (
              <button
                onClick={() => (isDir ? toggle(node.path) : void openPath(node))}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <span className={cn('truncate', isMain && 'font-medium text-foreground')}>
                  {node.name}
                </span>
                {isMain && <Star className="h-3 w-3 shrink-0 fill-spectral-3 text-spectral-3" />}
                {dirtyPaths.has(node.path) && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-spectral-2" />
                )}
              </button>
            )}

            {/* hover actions */}
            <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {isDir && (
                <>
                  <button
                    title="New file"
                    onClick={() => startNew(node.path, 'file')}
                    className="rounded p-0.5 hover:text-foreground"
                  >
                    <FilePlus className="h-3 w-3" />
                  </button>
                  <button
                    title="New folder"
                    onClick={() => startNew(node.path, 'dir')}
                    className="rounded p-0.5 hover:text-foreground"
                  >
                    <FolderPlus className="h-3 w-3" />
                  </button>
                </>
              )}
              {!isDir && node.name.endsWith('.tex') && !isMain && (
                <button
                  title="Set as main"
                  onClick={() => void setMain(node)}
                  className="rounded p-0.5 hover:text-foreground"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}
              <button
                title="Rename"
                onClick={() => {
                  setRenamingPath(node.path)
                  setRenameDraft(node.name)
                }}
                className="rounded p-0.5 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                title="Delete"
                onClick={() => {
                  if (window.confirm(`Delete ${node.name}?`)) void deleteEntry(node)
                }}
                className="rounded p-0.5 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {isDir && isOpen && (
            <div>
              {renderNewInput(node.path, depth + 1)}
              {node.children && renderNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full flex-col bg-surface/40">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <span className="px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Files
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            title="New file"
            onClick={() => dir && startNew(dir, 'file')}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            title="New folder"
            onClick={() => dir && startNew(dir, 'dir')}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            title="Refresh"
            onClick={() => void refreshTree()}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto py-1 pr-1',
          dropTarget === dir && 'bg-spectral-3/10'
        )}
        onDragOver={(e) => dir && handleDragOver(e, dir)}
        onDragLeave={(e) => dir && handleDragLeave(e, dir)}
        onDrop={(e) => dir && handleDrop(e, dir)}
      >
        {dir && newEntry?.parent === dir && renderNewInput(dir, 0)}
        {renderNodes(tree, 0)}
        {tree.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-muted-foreground/60">No files yet.</div>
        )}
      </div>
    </div>
  )
}
