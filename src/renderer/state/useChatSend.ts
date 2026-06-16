import { useCallback } from 'react'
import { toast } from 'sonner'
import { extractLatexBlock } from '@shared/latex'
import { useProject } from '@/state/useProject'

let reqCounter = 0

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Shared AI request path. `send` posts a free-form message; `fixError` feeds the
 * latest failed compile log back to the assistant and asks for a repaired
 * document. Both stream into the store so any mounted view (chat, thinking
 * panel) reflects progress.
 */
export function useChatSend() {
  const send = useCallback(async (message: string) => {
    const trimmed = message.trim()
    const start = useProject.getState()
    if (!trimmed || start.chatting) return

    start.addMessage({ role: 'user', content: trimmed })
    start.setChatting(true)
    start.setStreaming('')
    await waitForPaint()

    const requestId = `r${++reqCounter}`
    let acc = ''
    try {
      const { chat: history, settings, source } = useProject.getState()
      const full = await window.api.chat(
        {
          provider: settings.provider,
          model: settings.model,
          source,
          history,
          message: trimmed,
          requestId
        },
        (chunk) => {
          acc += chunk
          useProject.getState().setStreaming(acc)
        }
      )
      const latex = extractLatexBlock(full)
      useProject.getState().addMessage({
        role: 'assistant',
        content: full,
        reasoning: acc,
        applied: latex !== null
      })
      if (latex !== null) {
        useProject.getState().setSource(latex)
        toast.success('Document updated. Compile to preview.')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      useProject.getState().setStreaming('')
      useProject.getState().setChatting(false)
    }
  }, [])

  const fixError = useCallback(() => {
    const { lastCompile, chatting } = useProject.getState()
    if (chatting) return
    if (!lastCompile || lastCompile.ok) {
      toast.info('No compile error to fix.')
      return
    }
    const message = [
      'The document failed to compile with Tectonic. Rewrite the LaTeX so it',
      'compiles cleanly, keeping the intended content and structure. Fix the',
      'root cause shown in the log below (e.g. malformed environments, bad',
      'bibliography/.bbl entries, missing packages or \\item).',
      '',
      `Error: ${lastCompile.summary}`,
      '',
      'Compiler log:',
      lastCompile.log
    ].join('\n')
    void send(message)
  }, [send])

  return { send, fixError }
}
