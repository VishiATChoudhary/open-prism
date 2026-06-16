export type Provider = 'claude' | 'chatgpt'

export interface Settings {
  provider: Provider
  model: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Raw streamed CLI output retained for the collapsible reasoning view. */
  reasoning?: string
  /** True when this assistant reply was applied to the editor source. */
  applied?: boolean
}

export interface ProjectMeta {
  entry: string
  settings: Settings
  chatHistory: ChatMessage[]
}

export interface CompileResult {
  ok: boolean
  pdfPath?: string
  log: string
  summary: string
}

export interface OpenProjectResult {
  dir: string
  meta: ProjectMeta
  source: string
}

export interface RenameProjectEntryResult {
  meta: ProjectMeta
  source: string
}

export interface ProjectSummary {
  name: string
  dir: string
  entry: string
  updatedAt: number
}

export interface ProjectHome {
  rootDir: string
  projects: ProjectSummary[]
}

export interface FileNode {
  name: string
  /** Absolute path. */
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}
