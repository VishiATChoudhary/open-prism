import { useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, CornerDownRight } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@shared/types'
import { cn } from '@/lib/utils'
import { PrismGlyph } from './PrismGlyph'
import { ReasoningLog } from './ReasoningLog'

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border/70 bg-background/70">
      <button
        onClick={copy}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border/70 bg-elevated/80 px-1.5 py-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-spectral-4" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground/90">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-border/70 bg-elevated px-3.5 py-2 text-[13.5px] leading-relaxed text-foreground shadow-float">
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-2.5"
    >
      <div className="mt-0.5 h-5 w-5 shrink-0">
        <PrismGlyph />
      </div>
      <div className="min-w-0 flex-1 border-l border-spectral-1/30 pl-3">
        <div
          className={cn(
            'prose-chat text-[13.5px] leading-relaxed text-foreground/90',
            '[&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4',
            '[&_a]:text-spectral-3 [&_a]:underline [&_a]:underline-offset-2',
            '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[12px]'
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // react-markdown v10 routes fenced blocks through `pre`; extract the
              // text from its inner <code> and render our copyable CodeBlock.
              pre({ children }: any) {
                const codeEl = Array.isArray(children) ? children[0] : children
                const raw = codeEl?.props?.children
                const content = String(Array.isArray(raw) ? raw.join('') : (raw ?? '')).replace(
                  /\n$/,
                  ''
                )
                return <CodeBlock>{content}</CodeBlock>
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {message.applied && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-spectral-2/30 bg-spectral-2/10 px-2.5 py-0.5 text-[11px] font-medium text-spectral-3">
            <CornerDownRight className="h-3 w-3" />
            applied to document
          </div>
        )}

        {message.reasoning && <ReasoningLog text={message.reasoning} />}
      </div>
    </motion.div>
  )
}
