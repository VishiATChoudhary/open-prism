import { useEffect, useRef, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { redo, undo } from '@codemirror/commands'
import { EditorView, keymap } from '@codemirror/view'
import { toast } from 'sonner'
import { Loader2, Redo2, Sparkles, Undo2 } from 'lucide-react'
import { useProject } from '@/state/useProject'
import { prismEditorThemeDark, prismEditorThemeLight } from '@/lib/editorTheme'
import { useTheme } from '@/lib/theme'
import { findSourceMatch } from '@/lib/sourceJump'
import { EditorTabs } from '@/components/EditorTabs'
import { Button } from '@/components/ui/button'

const CONTEXT_CHARS = 1200
const EDITOR_HISTORY_KEYS = keymap.of([
  { key: 'Mod-z', run: undo },
  { key: 'Mod-y', run: redo },
  { key: 'Mod-Shift-z', run: redo }
])

/** Strip a markdown code fence if the model wrapped its reply in one. */
function stripFence(s: string): string {
  const fenced = s.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
  return (fenced ? fenced[1] : s).replace(/^\n+/, '').replace(/\s+$/, '')
}

interface InlineBar {
  from: number
  to: number
  left: number
  top: number
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"], .cm-editor'))
}

export function EditorPane() {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const handledJumpId = useRef<number | null>(null)
  const source = useProject((s) => s.source)
  const setSource = useProject((s) => s.setSource)
  const activePath = useProject((s) => s.activePath)
  const sourceJump = useProject((s) => s.sourceJump)
  const theme = useTheme()

  const [bar, setBar] = useState<InlineBar | null>(null)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  function undoEditor() {
    const view = editorRef.current?.view
    if (!view) return
    undo(view)
    view.focus()
  }

  function redoEditor() {
    const view = editorRef.current?.view
    if (!view) return
    redo(view)
    view.focus()
  }

  function closeBar() {
    setBar(null)
    setInstruction('')
    editorRef.current?.view?.focus()
  }

  // While the inline bar is open, dismiss on Escape (anywhere) or outside click.
  useEffect(() => {
    if (!bar) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        closeBar()
      }
    }
    function onDown(e: MouseEvent) {
      if (!busy && barRef.current && !barRef.current.contains(e.target as Node)) closeBar()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [bar, busy])

  useEffect(() => {
    if (!activePath) return

    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || isEditableTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (!e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        undoEditor()
        return
      }

      if (
        (e.key === 'y' || e.key === 'Y') ||
        (e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault()
        redoEditor()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activePath])

  useEffect(() => {
    if (!sourceJump) return
    if (sourceJump.id === handledJumpId.current) return

    const view = editorRef.current?.view
    if (!view) return
    handledJumpId.current = sourceJump.id

    const match = findSourceMatch(source, sourceJump.text)
    if (!match) {
      toast.warning('No matching source text found.')
      return
    }

    view.dispatch({
      selection: { anchor: match.from, head: match.to },
      effects: EditorView.scrollIntoView(match.from, { y: 'center' })
    })
  }, [sourceJump, source])

  function openInlineEdit() {
    if (bar) {
      closeBar()
      return
    }
    const view = editorRef.current?.view
    if (!view) return
    const { from, to } = view.state.selection.main
    const coords = view.coordsAtPos(from)
    setInstruction('')
    setBar({
      from,
      to,
      left: coords?.left ?? 240,
      top: (coords?.bottom ?? 160) + 6
    })
  }

  async function runInlineEdit() {
    const view = editorRef.current?.view
    if (!view || !bar || busy) return
    const instr = instruction.trim()
    if (!instr) return

    const { from, to } = bar
    const doc = view.state.doc
    const selection = doc.sliceString(from, to)
    const before = doc.sliceString(Math.max(0, from - CONTEXT_CHARS), from)
    const after = doc.sliceString(to, Math.min(doc.length, to + CONTEXT_CHARS))
    const { settings } = useProject.getState()

    setBusy(true)
    try {
      const raw = await window.api.inlineEdit({
        provider: settings.provider,
        model: settings.model,
        selection,
        instruction: instr,
        before,
        after
      })
      const replacement = stripFence(raw)
      if (!replacement) {
        toast.error('The assistant returned nothing.')
        return
      }
      view.dispatch({
        changes: { from, to, insert: replacement },
        selection: { anchor: from, head: from + replacement.length }
      })
      view.focus()
      setBar(null)
      setInstruction('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {activePath && (
        <div className="flex min-h-9 shrink-0 items-stretch border-b border-border/60 bg-surface/40">
          <EditorTabs />
          <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-border/60 px-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={undoEditor}
              title="Undo (Cmd+Z / Ctrl+Z)"
              aria-label="Undo"
              className="h-7 w-7"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={redoEditor}
              title="Redo (Cmd+Y / Ctrl+Y)"
              aria-label="Redo"
              className="h-7 w-7"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      <div
        className="relative min-h-0 flex-1 overflow-auto"
        onKeyDownCapture={(e) => {
          if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault()
            e.stopPropagation()
            openInlineEdit()
          }
        }}
      >
        {activePath ? (
          <CodeMirror
            key={activePath}
            ref={editorRef}
            value={source}
            height="100%"
            theme={theme === 'dark' ? prismEditorThemeDark : prismEditorThemeLight}
            extensions={[StreamLanguage.define(stex), EditorView.lineWrapping, EDITOR_HISTORY_KEYS]}
            onChange={setSource}
            basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: false }}
            style={{ height: '100%', fontSize: '13px' }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12.5px] text-muted-foreground/60">
            Open a file from the explorer to start editing.
          </div>
        )}
      </div>

      {bar && (
        <div
          ref={barRef}
          className="fixed z-50 w-[340px] max-w-[90vw]"
          style={{ left: Math.min(bar.left, window.innerWidth - 360), top: bar.top }}
        >
          <div className="rainbow-focus">
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-elevated px-2.5 py-2 shadow-float">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-spectral-3" />
              <input
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void runInlineEdit()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setBar(null)
                    editorRef.current?.view?.focus()
                  }
                }}
                disabled={busy}
                placeholder={bar.from === bar.to ? 'Insert with AI…' : 'Edit selection with AI…'}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <kbd className="shrink-0 rounded bg-muted px-1 font-mono text-[9px] text-muted-foreground">
                  ⏎
                </kbd>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
