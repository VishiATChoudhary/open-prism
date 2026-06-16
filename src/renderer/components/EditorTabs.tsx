import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProject } from '@/state/useProject'

export function EditorTabs() {
  const openFiles = useProject((s) => s.openFiles)
  const activePath = useProject((s) => s.activePath)
  const activateTab = useProject((s) => s.activateTab)
  const closeTab = useProject((s) => s.closeTab)

  if (openFiles.length === 0) return null

  return (
    <div className="flex items-stretch overflow-x-auto border-b border-border/60 bg-surface/40">
      {openFiles.map((f) => {
        const active = f.path === activePath
        return (
          <div
            key={f.path}
            className={cn(
              'group flex shrink-0 items-center gap-1.5 border-r border-border/60 px-3 py-1.5 text-[12px]',
              active
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:bg-accent/60'
            )}
          >
            <button
              onClick={() => activateTab(f.path)}
              className="flex items-center gap-1.5 font-mono"
            >
              <span className="max-w-[160px] truncate">{f.name}</span>
              {f.dirty && <span className="h-1.5 w-1.5 rounded-full bg-spectral-2" />}
            </button>
            <button
              onClick={() => closeTab(f.path)}
              aria-label={`Close ${f.name}`}
              className="rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
