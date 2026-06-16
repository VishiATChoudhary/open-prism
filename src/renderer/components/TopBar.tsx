import { useState } from 'react'
import { toast } from 'sonner'
import { Check, FilePlus, Home, Loader2, PanelLeft, Pencil, Play, Save, X } from 'lucide-react'
import { useProject } from '@/state/useProject'
import { useFiles } from '@/state/useFiles'
import { Button } from '@/components/ui/button'
import { PrismGlyph } from '@/components/chat/PrismGlyph'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SettingsDialog } from './SettingsDialog'

interface TopBarProps {
  onHome: () => void
}

export function TopBar({ onHome }: TopBarProps) {
  const { dir, meta, settings, chat, compiling } = useProject()
  const loadProject = useProject((s) => s.loadProject)
  const setDir = useProject((s) => s.setDir)
  const toggleSidebar = useProject((s) => s.toggleSidebar)
  const { writeAllDirty, compileProject } = useFiles()

  const projectName = dir?.split('/').filter(Boolean).pop() ?? 'no project'

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)

  function startRename() {
    if (!dir) return
    setNameDraft(projectName)
    setEditing(true)
  }

  async function commitRename() {
    const next = nameDraft.trim()
    if (!dir || !next || next === projectName) {
      setEditing(false)
      return
    }
    setRenaming(true)
    try {
      const summary = await window.api.renameProject(dir, next)
      setDir(summary.dir)
      setEditing(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRenaming(false)
    }
  }

  async function newProject() {
    const name = window.prompt('New project name')
    if (!name?.trim()) return
    const res = await window.api.newProject(name)
    loadProject(res)
  }

  async function save() {
    if (!dir || !meta) return
    await writeAllDirty()
    await window.api.saveMeta(dir, { ...meta, chatHistory: chat, settings })
    toast.success('Saved.')
  }

  async function compile() {
    const result = await compileProject()
    if (!result) return
    if (result.ok) toast.success('Compiled.')
    else toast.error(result.summary)
  }

  return (
    <div className="glass flex items-center gap-3 border-b border-border/60 px-3.5 py-2">
      <button
        onClick={toggleSidebar}
        title="Toggle file explorer (⌘B)"
        aria-label="Toggle file explorer"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4">
          <PrismGlyph />
        </div>
        <span className="font-display text-[14px] italic tracking-tight text-foreground">
          Open Prism
        </span>
      </div>
      <span className="h-3.5 w-px bg-border" />
      {editing ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            void commitRename()
          }}
        >
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
            disabled={renaming}
            className="h-6 w-[180px] rounded-md border border-border/80 bg-background/60 px-2 text-[12px] text-foreground outline-none focus:border-spectral-1/40"
          />
          <button
            type="submit"
            disabled={renaming}
            aria-label="Save name"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-spectral-4 hover:bg-accent disabled:opacity-40"
          >
            {renaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={renaming}
            aria-label="Cancel"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <X className="h-3 w-3" />
          </button>
        </form>
      ) : (
        <button
          onClick={startRename}
          disabled={!dir}
          title={dir ? 'Rename project' : undefined}
          className="group inline-flex items-center gap-1.5 disabled:cursor-default"
        >
          <span className="max-w-[220px] truncate text-[12px] text-muted-foreground">
            {projectName}
          </span>
          {dir && (
            <Pencil className="h-3 w-3 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70" />
          )}
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onHome}>
          <Home className="h-3.5 w-3.5" /> Home
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void newProject()}>
          <FilePlus className="h-3.5 w-3.5" /> New
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void save()} disabled={!dir}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
        <Button
          size="sm"
          onClick={() => void compile()}
          disabled={!dir || compiling}
          className="ml-1"
        >
          {compiling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Compile
          <kbd className="ml-1 rounded bg-primary-foreground/15 px-1 font-mono text-[9px]">⌘↵</kbd>
        </Button>
        <ThemeToggle />
        <SettingsDialog />
      </div>
    </div>
  )
}
