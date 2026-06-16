import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  FileArchive,
  FilePlus,
  Loader2,
  Pencil,
  RotateCw,
  Trash2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectHome, ProjectSummary } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProject } from '@/state/useProject'
import { PrismGlyph } from '@/components/chat/PrismGlyph'
import { ThemeToggle } from '@/components/ThemeToggle'

interface HomeScreenProps {
  onOpenProject: () => void
}

export function HomeScreen({ onOpenProject }: HomeScreenProps) {
  const loadProject = useProject((s) => s.loadProject)
  const setDir = useProject((s) => s.setDir)
  const clearProject = useProject((s) => s.clearProject)
  const [home, setHome] = useState<ProjectHome | null>(null)
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [openingDir, setOpeningDir] = useState<string | null>(null)
  const [editingDir, setEditingDir] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setHome(await window.api.listProjects())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function createProject() {
    const name = projectName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const project = await window.api.newProject(name)
      loadProject(project)
      onOpenProject()
    } finally {
      setCreating(false)
    }
  }

  async function importZipProject() {
    if (importing) return
    setImporting(true)
    try {
      const project = await window.api.importZipProject()
      if (!project) return
      loadProject(project)
      toast.success('Project imported.')
      onOpenProject()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  async function openProject(project: ProjectSummary) {
    setOpeningDir(project.dir)
    try {
      const opened = await window.api.openProject(project.dir)
      if (opened) {
        loadProject(opened)
        onOpenProject()
      }
    } finally {
      setOpeningDir(null)
    }
  }

  function startRename(project: ProjectSummary) {
    setEditingDir(project.dir)
    setEditName(project.name)
  }

  function cancelRename() {
    setEditingDir(null)
    setEditName('')
  }

  async function commitRename(project: ProjectSummary) {
    const name = editName.trim()
    if (!name || name === project.name) {
      cancelRename()
      return
    }
    setRenaming(true)
    try {
      const summary = await window.api.renameProject(project.dir, name)
      if (useProject.getState().dir === project.dir) setDir(summary.dir)
      cancelRename()
      await refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRenaming(false)
    }
  }

  function requestDelete(project: ProjectSummary) {
    setProjectToDelete(project)
    setDeleteConfirmation('')
  }

  async function confirmDelete() {
    if (!projectToDelete || deleteConfirmation !== projectToDelete.name || deleting) return
    setDeleting(true)
    try {
      await window.api.deleteProject(projectToDelete.dir)
      if (useProject.getState().dir === projectToDelete.dir) clearProject()
      toast.success('Project deleted.')
      setProjectToDelete(null)
      setDeleteConfirmation('')
      await refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-background">
      {/* Grain texture over the whole home surface */}
      <div className="grain-tex pointer-events-none absolute inset-0 z-0" />

      <ThemeToggle className="absolute right-4 top-4 z-20" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            initial={{ rotate: -10, scale: 0.85, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="h-12 w-12 drop-shadow-[0_0_24px_hsl(var(--spectral-1)/0.5)]"
          >
            <PrismGlyph />
          </motion.div>
          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-foreground">
            Open <span className="italic text-spectral">Prism</span>
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Describe a document in plain language. The assistant writes the LaTeX,
            you compile it to PDF and iterate — locally, with your own CLI.
          </p>
        </motion.div>

        {/* New project */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void createProject()
          }}
        >
          <div className="rainbow-focus flex-1">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Name a new document…"
              className="h-11 w-full rounded-xl border border-border/80 bg-elevated px-4 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-transparent"
            />
          </div>
          <Button type="submit" disabled={!projectName.trim() || creating} className="h-11 px-4">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus className="h-4 w-4" />}
            Create
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            className="h-11 px-4"
            onClick={() => void importZipProject()}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            Import
          </Button>
        </motion.form>

        {/* Projects */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24, duration: 0.6 }}
          className="mt-12"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Recent · {home?.projects.length ?? 0}
            </h2>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <RotateCw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
              Refresh
            </button>
          </div>

          {loading && (
            <div className="flex h-28 items-center justify-center text-[13px] text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading projects
            </div>
          )}

          {!loading && home?.projects.length === 0 && (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/70 text-[13px] text-muted-foreground">
              No documents yet. Name one above to begin.
            </div>
          )}

          {!loading && home && home.projects.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {home.projects.map((project, i) => {
                const editing = editingDir === project.dir
                return (
                  <motion.div
                    key={project.dir}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 + i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-elevated/30 px-4 py-3 transition-all hover:border-spectral-1/30 hover:bg-elevated/60"
                  >
                    {editing ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void commitRename(project)
                        }}
                      >
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelRename()
                          }}
                          disabled={renaming}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-border/80 bg-background/60 px-2.5 text-[14px] text-foreground outline-none focus:border-spectral-1/40"
                        />
                        <button
                          type="submit"
                          disabled={renaming}
                          aria-label="Save name"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-spectral-4 transition-colors hover:bg-accent disabled:opacity-40"
                        >
                          {renaming ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          disabled={renaming}
                          aria-label="Cancel"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          onClick={() => void openProject(project)}
                          className="flex min-w-0 flex-1 flex-col text-left"
                        >
                          <span className="truncate text-[14px] font-medium text-foreground">
                            {project.name}
                          </span>
                          <span className="truncate font-mono text-[11px] text-muted-foreground/60">
                            {project.dir}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground/60">
                          <button
                            onClick={() => startRename(project)}
                            aria-label="Rename project"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => requestDelete(project)}
                            aria-label="Delete project"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <span className="tabular-nums">
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                          {openingDir === project.dir ? (
                            <Loader2 className="h-4 w-4 animate-spin text-spectral-2" />
                          ) : (
                            <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.section>
      </div>
      <Dialog
        open={projectToDelete !== null}
        onOpenChange={(open) => {
          if (deleting) return
          if (!open) {
            setProjectToDelete(null)
            setDeleteConfirmation('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Are you sure? This will permanently delete{' '}
              <span className="font-medium text-foreground">{projectToDelete?.name}</span> and all
              files inside it. Type the project name to confirm.
            </p>
            <input
              autoFocus
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={projectToDelete?.name}
              disabled={deleting}
              className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-destructive/50"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setProjectToDelete(null)
                  setDeleteConfirmation('')
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmDelete()}
                disabled={!projectToDelete || deleteConfirmation !== projectToDelete.name || deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
