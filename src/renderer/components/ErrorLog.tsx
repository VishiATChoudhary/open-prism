import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { useProject } from '@/state/useProject'
import { useChatSend } from '@/state/useChatSend'

export function ErrorLog() {
  const last = useProject((s) => s.lastCompile)
  const chatting = useProject((s) => s.chatting)
  const { fixError } = useChatSend()
  const [open, setOpen] = useState(false)
  if (!last || last.ok) return null

  return (
    <div className="border-t border-destructive/30 bg-destructive/10 text-sm">
      <div className="flex items-center gap-2 pr-2">
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-[12.5px] font-medium text-destructive"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{last.summary}</span>
        </button>
        <button
          onClick={fixError}
          disabled={chatting}
          title="Fix with AI (⌘⇧F)"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-spectral-1/30 bg-spectral-1/10 px-2.5 py-1 text-[11px] font-medium text-spectral-3 transition-colors hover:bg-spectral-1/20 disabled:opacity-40"
        >
          {chatting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Fix with AI
          <kbd className="ml-0.5 rounded bg-spectral-1/15 px-1 font-mono text-[9px]">⌘⇧F</kbd>
        </button>
      </div>
      {open && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-3 font-mono text-[11px] leading-relaxed text-destructive-foreground/70">
          {last.log}
        </pre>
      )}
    </div>
  )
}
