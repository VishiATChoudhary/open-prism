import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  Settings,
  ProjectMeta,
  ProjectHome,
  ProjectSummary,
  OpenProjectResult,
  RenameProjectEntryResult,
  CompileResult,
  ChatMessage,
  FileNode,
  Provider
} from '../shared/types'

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (s: Settings): Promise<void> => ipcRenderer.invoke('settings:set', s),

  listProjects: (): Promise<ProjectHome> => ipcRenderer.invoke('project:list'),
  newProject: (name: string): Promise<OpenProjectResult> => ipcRenderer.invoke('project:new', name),
  importZipProject: (): Promise<OpenProjectResult | null> => ipcRenderer.invoke('project:importZip'),
  openProject: (dir: string): Promise<OpenProjectResult> => ipcRenderer.invoke('project:open', dir),
  renameProject: (dir: string, nextName: string): Promise<ProjectSummary> =>
    ipcRenderer.invoke('project:rename', dir, nextName),
  deleteProject: (dir: string): Promise<void> => ipcRenderer.invoke('project:delete', dir),
  saveProject: (dir: string, meta: ProjectMeta, source: string): Promise<void> =>
    ipcRenderer.invoke('project:save', dir, meta, source),
  saveMeta: (dir: string, meta: ProjectMeta): Promise<void> =>
    ipcRenderer.invoke('project:saveMeta', dir, meta),
  renameProjectEntry: (
    dir: string,
    meta: ProjectMeta,
    source: string,
    nextEntry: string
  ): Promise<RenameProjectEntryResult> =>
    ipcRenderer.invoke('project:renameEntry', dir, meta, source, nextEntry),

  readFile: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
  readBinaryFile: (path: string): Promise<Uint8Array> => ipcRenderer.invoke('file:readBinary', path),
  writeFile: (path: string, data: string): Promise<void> =>
    ipcRenderer.invoke('file:write', path, data),
  droppedFilePath: (file: File): string => webUtils.getPathForFile(file),

  fileTree: (dir: string): Promise<FileNode[]> => ipcRenderer.invoke('file:tree', dir),
  createEntry: (path: string, isDir: boolean): Promise<void> =>
    ipcRenderer.invoke('file:create', path, isDir),
  deleteEntry: (path: string): Promise<void> => ipcRenderer.invoke('file:delete', path),
  renameEntry: (path: string, nextName: string): Promise<string> =>
    ipcRenderer.invoke('file:rename', path, nextName),
  moveEntry: (path: string, targetDir: string): Promise<string> =>
    ipcRenderer.invoke('file:move', path, targetDir),
  copyExternalEntries: (paths: string[], targetDir: string): Promise<void> =>
    ipcRenderer.invoke('file:copyExternal', paths, targetDir),

  compile: (dir: string, entry: string): Promise<CompileResult> =>
    ipcRenderer.invoke('compile', dir, entry),

  chat: (
    args: {
      provider: Provider
      model: string
      source: string
      history: ChatMessage[]
      message: string
      requestId: string
    },
    onChunk: (chunk: string) => void
  ): Promise<string> => {
    const channel = `ai:chunk:${args.requestId}`
    const listener = (_e: Electron.IpcRendererEvent, chunk: string): void => onChunk(chunk)
    ipcRenderer.on(channel, listener)
    return ipcRenderer.invoke('ai:chat', args).finally(() => {
      ipcRenderer.removeListener(channel, listener)
    })
  },

  inlineEdit: (args: {
    provider: Provider
    model: string
    selection: string
    instruction: string
    before: string
    after: string
  }): Promise<string> => ipcRenderer.invoke('ai:inlineEdit', args)
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
