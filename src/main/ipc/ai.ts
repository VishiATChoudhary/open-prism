import { ipcMain } from 'electron'
import { runAiCli } from '../services/aiCli'
import { buildInlinePrompt, buildPrompt } from '../../shared/prompt'
import type { ChatMessage, Provider } from '../../shared/types'

interface ChatArgs {
  provider: Provider
  model: string
  source: string
  history: ChatMessage[]
  message: string
  requestId: string
}

interface InlineArgs {
  provider: Provider
  model: string
  selection: string
  instruction: string
  before: string
  after: string
}

export function registerAi(): void {
  ipcMain.handle('ai:chat', async (e, args: ChatArgs) => {
    const prompt = buildPrompt({
      source: args.source,
      history: args.history,
      message: args.message
    })
    const sender = e.sender
    return runAiCli(args.provider, args.model, prompt, (chunk) => {
      if (!sender.isDestroyed()) sender.send(`ai:chunk:${args.requestId}`, chunk)
    })
  })

  ipcMain.handle('ai:inlineEdit', async (_e, args: InlineArgs) => {
    const prompt = buildInlinePrompt({
      selection: args.selection,
      instruction: args.instruction,
      before: args.before,
      after: args.after
    })
    return runAiCli(args.provider, args.model, prompt, () => {})
  })
}
