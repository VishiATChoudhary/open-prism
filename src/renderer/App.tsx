import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { ChatPane } from '@/components/ChatPane'
import { EditorPane } from '@/components/EditorPane'
import { ErrorLog } from '@/components/ErrorLog'
import { FileTree } from '@/components/FileTree'
import { HomeScreen } from '@/components/HomeScreen'
import { PdfPane } from '@/components/PdfPane'
import { SplashScreen } from '@/components/SplashScreen'
import { TopBar } from '@/components/TopBar'
import { useProject } from '@/state/useProject'
import { useChatSend } from '@/state/useChatSend'
import { useFiles } from '@/state/useFiles'

export default function App() {
  const [showHome, setShowHome] = useState(true)
  const [splashDone, setSplashDone] = useState(false)
  const setSettings = useProject((s) => s.setSettings)
  const dir = useProject((s) => s.dir)
  const sidebarOpen = useProject((s) => s.sidebarOpen)
  const toggleSidebar = useProject((s) => s.toggleSidebar)
  const { fixError } = useChatSend()
  const { compileProject } = useFiles()

  useEffect(() => {
    if (!window.api) return
    void window.api.getSettings().then((s) => {
      // codex/chatgpt is disabled for now — always fall back to Claude.
      const next = s.provider === 'claude' ? s : { ...s, provider: 'claude' as const }
      setSettings(next)
      if (next !== s) void window.api.setSettings(next)
    })
  }, [setSettings])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        void compileProject()
        return
      }
      // ⌘B / Ctrl+B — toggle the file explorer
      if (mod && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        toggleSidebar()
        return
      }
      // ⌘⇧F / Ctrl+⇧F — feed the latest compile error to the assistant
      if (mod && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault()
        fixError()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compileProject, toggleSidebar, fixError])

  if (!window.api) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6 text-sm text-destructive">
        Open Prism could not load its Electron preload bridge.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {showHome || !dir ? (
        <HomeScreen onOpenProject={() => setShowHome(false)} />
      ) : (
        <>
          <TopBar onHome={() => setShowHome(true)} />
          <div className="flex min-h-0 flex-1">
            {sidebarOpen && (
              <div className="w-60 shrink-0 border-r border-border/60">
                <FileTree />
              </div>
            )}
            <PanelGroup direction="horizontal" className="min-w-0 flex-1">
              <Panel defaultSize={50} minSize={25}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={60} minSize={20}>
                    <EditorPane />
                  </Panel>
                  <PanelResizeHandle className="group relative h-px bg-border transition-colors data-[resize-handle-state=drag]:bg-spectral-1/60 hover:bg-spectral-1/40" />
                  <Panel defaultSize={40} minSize={15}>
                    <ChatPane />
                  </Panel>
                </PanelGroup>
              </Panel>
              <PanelResizeHandle className="group relative w-px bg-border transition-colors data-[resize-handle-state=drag]:bg-spectral-1/60 hover:bg-spectral-1/40" />
              <Panel defaultSize={50} minSize={25}>
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1">
                    <PdfPane />
                  </div>
                  <ErrorLog />
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </>
      )}
      <Toaster position="bottom-right" />
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    </div>
  )
}
