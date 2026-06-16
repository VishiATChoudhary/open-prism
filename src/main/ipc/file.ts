import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import {
  copyExternalEntries,
  createEntry,
  deleteEntry,
  moveEntry,
  readTree,
  renameEntry
} from '../services/fileTree'

export function registerFile(): void {
  ipcMain.handle('file:read', (_e, path: string) => fs.readFile(path, 'utf8'))
  ipcMain.handle('file:readBinary', (_e, path: string) => fs.readFile(path))
  ipcMain.handle('file:write', (_e, path: string, data: string) => fs.writeFile(path, data, 'utf8'))

  ipcMain.handle('file:tree', (_e, dir: string) => readTree(dir))
  ipcMain.handle('file:create', (_e, path: string, isDir: boolean) => createEntry(path, isDir))
  ipcMain.handle('file:delete', (_e, path: string) => deleteEntry(path))
  ipcMain.handle('file:rename', (_e, path: string, nextName: string) => renameEntry(path, nextName))
  ipcMain.handle('file:move', (_e, path: string, targetDir: string) => moveEntry(path, targetDir))
  ipcMain.handle('file:copyExternal', (_e, paths: string[], targetDir: string) =>
    copyExternalEntries(paths, targetDir)
  )
}
