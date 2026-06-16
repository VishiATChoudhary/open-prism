import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Highlighter, ZoomIn, ZoomOut } from 'lucide-react'
import { useProject } from '@/state/useProject'
import { Button } from '@/components/ui/button'
import { PrismGlyph } from '@/components/chat/PrismGlyph'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export function PdfPane() {
  const pdfPath = useProject((s) => s.pdfPath)
  const pdfVersion = useProject((s) => s.pdfVersion)
  const requestSourceJump = useProject((s) => s.requestSourceJump)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.2)

  useEffect(() => {
    if (!pdfPath || !containerRef.current) return
    let cancelled = false
    const renderTasks: pdfjs.RenderTask[] = []
    const textLayers: pdfjs.TextLayer[] = []
    const container = containerRef.current
    container.innerHTML = ''

    ;(async () => {
      const data = await window.api.readBinaryFile(pdfPath)
      const doc = await pdfjs.getDocument({ data }).promise
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return
        const page = await doc.getPage(n)
        const viewport = page.getViewport({ scale })
        const outputScale = Math.max(window.devicePixelRatio || 1, 1)
        const pageFrame = document.createElement('div')
        pageFrame.className = 'pdf-page-frame relative mx-auto my-3 rounded-sm shadow-float'
        pageFrame.style.setProperty('--scale-factor', String(scale))
        pageFrame.style.width = `${viewport.width}px`
        pageFrame.style.height = `${viewport.height}px`

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        canvas.className = 'block rounded-sm ring-1 ring-border/50'
        pageFrame.appendChild(canvas)

        const textLayerDiv = document.createElement('div')
        textLayerDiv.className = 'textLayer'
        pageFrame.appendChild(textLayerDiv)
        container.appendChild(pageFrame)

        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
        })
        renderTasks.push(renderTask)

        const textContent = await page.getTextContent()
        const textLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport
        })
        textLayers.push(textLayer)

        await Promise.all([renderTask.promise, textLayer.render()])
      }
    })().catch(() => {
      if (!cancelled) container.innerHTML = ''
    })

    return () => {
      cancelled = true
      renderTasks.forEach((task) => task.cancel())
      textLayers.forEach((layer) => layer.cancel())
    }
  }, [pdfPath, pdfVersion, scale])

  function jumpFromSelection() {
    const container = containerRef.current
    const selection = window.getSelection()
    if (!container || !selection || selection.isCollapsed) return

    const anchor = selection.anchorNode
    const focus = selection.focusNode
    if (!anchor || !focus || !container.contains(anchor) || !container.contains(focus)) return

    const selectedText = selection.toString().replace(/\s+/g, ' ').trim()
    if (selectedText.length < 2) return
    requestSourceJump(selectedText)
  }

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--pdf-bg))]">
      <div className="flex items-center gap-1 border-b border-border/60 bg-surface/40 px-2 py-1.5">
        <span className="px-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Preview
        </span>
        <Highlighter className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-11 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto px-4" onMouseUp={jumpFromSelection}>
        {!pdfPath && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="h-8 w-8 opacity-40">
              <PrismGlyph />
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              Compile to refract your source into a PDF.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
