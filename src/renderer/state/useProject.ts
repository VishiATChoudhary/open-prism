import { create } from 'zustand'
import type { Settings, ProjectMeta, ChatMessage, CompileResult, FileNode } from '@shared/types'

export interface OpenFile {
  /** Absolute path on disk. */
  path: string
  /** Display name (basename). */
  name: string
  content: string
  dirty: boolean
}

function baseName(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p
}

function movedPath(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) return newPath
  if (path.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`
  return path
}

interface ProjectState {
  dir: string | null
  meta: ProjectMeta | null
  /** Content of the active editor tab. Mirror of openFiles[active].content. */
  source: string
  /** Absolute path of the project's main entry file. */
  entryPath: string | null
  tree: FileNode[]
  openFiles: OpenFile[]
  activePath: string | null
  sidebarOpen: boolean
  pdfPath: string | null
  pdfVersion: number
  chat: ChatMessage[]
  settings: Settings
  compiling: boolean
  chatting: boolean
  streaming: string
  lastCompile: CompileResult | null
  sourceJump: { id: number; text: string } | null

  setSource: (s: string) => void
  setStreaming: (s: string) => void
  setDir: (dir: string) => void
  setMeta: (m: ProjectMeta) => void
  setEntry: (relativeEntry: string, absPath: string) => void
  setTree: (tree: FileNode[]) => void
  toggleSidebar: () => void
  setSidebar: (open: boolean) => void
  openTab: (file: { path: string; content: string }) => void
  activateTab: (path: string) => void
  closeTab: (path: string) => void
  renameOpen: (oldPath: string, newPath: string) => void
  markAllSaved: () => void
  clearProject: () => void
  requestSourceJump: (text: string) => void
  loadProject: (p: { dir: string; meta: ProjectMeta; source: string }) => void
  setSettings: (s: Settings) => void
  setChat: (c: ChatMessage[]) => void
  addMessage: (m: ChatMessage) => void
  setCompiling: (b: boolean) => void
  setChatting: (b: boolean) => void
  setCompileResult: (r: CompileResult) => void
}

export const useProject = create<ProjectState>((set) => ({
  dir: null,
  meta: null,
  source: '',
  entryPath: null,
  tree: [],
  openFiles: [],
  activePath: null,
  sidebarOpen: true,
  pdfPath: null,
  pdfVersion: 0,
  chat: [],
  settings: { provider: 'claude', model: '' },
  compiling: false,
  chatting: false,
  streaming: '',
  lastCompile: null,
  sourceJump: null,

  setSource: (s) =>
    set((st) => ({
      source: s,
      openFiles: st.openFiles.map((f) =>
        f.path === st.activePath ? { ...f, content: s, dirty: true } : f
      )
    })),
  setStreaming: (s) => set({ streaming: s }),
  setDir: (dir) => set({ dir }),
  setMeta: (m) => set({ meta: m }),
  setEntry: (relativeEntry, absPath) =>
    set((st) => ({
      meta: st.meta ? { ...st.meta, entry: relativeEntry } : st.meta,
      entryPath: absPath
    })),
  setTree: (tree) => set({ tree }),
  toggleSidebar: () => set((st) => ({ sidebarOpen: !st.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),
  openTab: ({ path, content }) =>
    set((st) => {
      const existing = st.openFiles.find((f) => f.path === path)
      if (existing) return { activePath: path, source: existing.content }
      return {
        openFiles: [...st.openFiles, { path, name: baseName(path), content, dirty: false }],
        activePath: path,
        source: content
      }
    }),
  activateTab: (path) =>
    set((st) => {
      const f = st.openFiles.find((x) => x.path === path)
      return f ? { activePath: path, source: f.content } : {}
    }),
  closeTab: (path) =>
    set((st) => {
      const idx = st.openFiles.findIndex((f) => f.path === path)
      if (idx < 0) return {}
      const next = st.openFiles.filter((f) => f.path !== path)
      if (st.activePath !== path) return { openFiles: next }
      const fallback = next[idx] ?? next[idx - 1] ?? null
      return {
        openFiles: next,
        activePath: fallback?.path ?? null,
        source: fallback?.content ?? ''
      }
    }),
  renameOpen: (oldPath, newPath) =>
    set((st) => ({
      openFiles: st.openFiles.map((f) =>
        f.path === oldPath || f.path.startsWith(`${oldPath}/`)
          ? { ...f, path: movedPath(f.path, oldPath, newPath), name: baseName(movedPath(f.path, oldPath, newPath)) }
          : f
      ),
      activePath: st.activePath ? movedPath(st.activePath, oldPath, newPath) : st.activePath,
      entryPath: st.entryPath ? movedPath(st.entryPath, oldPath, newPath) : st.entryPath
    })),
  markAllSaved: () =>
    set((st) => ({ openFiles: st.openFiles.map((f) => ({ ...f, dirty: false })) })),
  clearProject: () =>
    set({
      dir: null,
      meta: null,
      source: '',
      entryPath: null,
      tree: [],
      openFiles: [],
      activePath: null,
      pdfPath: null,
      pdfVersion: 0,
      chat: [],
      compiling: false,
      chatting: false,
      streaming: '',
      lastCompile: null,
      sourceJump: null
    }),
  requestSourceJump: (text) =>
    set((st) => ({
      sourceJump: { id: (st.sourceJump?.id ?? 0) + 1, text }
    })),
  loadProject: (p) => {
    const entryPath = `${p.dir}/${p.meta.entry}`
    set({
      dir: p.dir,
      meta: p.meta,
      source: p.source,
      entryPath,
      tree: [],
      openFiles: [{ path: entryPath, name: baseName(entryPath), content: p.source, dirty: false }],
      activePath: entryPath,
      chat: p.meta.chatHistory,
      settings: p.meta.settings,
      pdfPath: null,
      pdfVersion: 0,
      streaming: '',
      lastCompile: null,
      sourceJump: null
    })
  },
  setSettings: (s) => set({ settings: s }),
  setChat: (c) => set({ chat: c }),
  addMessage: (m) => set((st) => ({ chat: [...st.chat, m] })),
  setCompiling: (b) => set({ compiling: b }),
  setChatting: (b) => set({ chatting: b }),
  setCompileResult: (r) =>
    set((st) => ({
      lastCompile: r,
      pdfPath: r.ok ? r.pdfPath ?? null : st.pdfPath,
      pdfVersion: r.ok ? st.pdfVersion + 1 : st.pdfVersion
    }))
}))
