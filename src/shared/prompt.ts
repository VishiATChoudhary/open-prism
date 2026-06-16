import type { ChatMessage } from './types'

const SYSTEM = `You are a LaTeX authoring assistant inside a desktop app.
You edit a single LaTeX document for the user. When the user asks for any change,
reply with the COMPLETE updated document inside one \`\`\`latex code block.
Do not include explanations inside the code block. A short sentence of context
outside the block is fine.

The document MUST compile standalone with Tectonic in one pass:
- Only edit the one file shown; you cannot create other files. Never \\input or
  \\include files that do not already exist.
- For references, do NOT use \\bibliography{...}/\\bibliographystyle with an
  external .bib file (it will not exist and BibTeX will fail). Instead embed an
  inline \\begin{thebibliography}{N} ... \\end{thebibliography} with real
  \\bibitem entries, or use filecontents to inline a .bib. Never emit an empty
  thebibliography environment (that causes "missing \\item" errors).
- Prefer widely available packages. Ensure every environment is balanced.`

const HISTORY_LIMIT = 6

export function buildPrompt(args: {
  source: string
  history: ChatMessage[]
  message: string
}): string {
  const recent = args.history.slice(-HISTORY_LIMIT)
  const historyText = recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
  return [
    SYSTEM,
    '',
    'CURRENT DOCUMENT:',
    '```latex',
    args.source,
    '```',
    '',
    historyText ? `CONVERSATION SO FAR:\n${historyText}\n` : '',
    `USER REQUEST: ${args.message}`
  ].join('\n')
}

/**
 * Prompt for an inline (⌘K) edit: the model rewrites ONLY the selected snippet
 * and returns the raw replacement — no fences, no prose, no surrounding context.
 */
export function buildInlinePrompt(args: {
  selection: string
  instruction: string
  before: string
  after: string
}): string {
  const mode = args.selection.trim()
    ? 'Rewrite the SELECTED TEXT according to the instruction.'
    : 'The selection is empty — produce LaTeX to INSERT at the cursor.'
  return [
    'You are editing a LaTeX document inside a code editor.',
    mode,
    'Output ONLY the replacement LaTeX. No code fences, no markdown, no comments,',
    'no explanation, and do not repeat the surrounding context. Keep it compilable',
    'and consistent with the surrounding code.',
    '',
    'CONTEXT BEFORE (do not repeat):',
    '"""',
    args.before,
    '"""',
    '',
    'SELECTED TEXT (replace this):',
    '"""',
    args.selection,
    '"""',
    '',
    'CONTEXT AFTER (do not repeat):',
    '"""',
    args.after,
    '"""',
    '',
    `INSTRUCTION: ${args.instruction}`
  ].join('\n')
}
