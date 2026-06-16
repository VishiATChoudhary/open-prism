import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  deleteProject,
  importProjectZip,
  listProjects,
  newProject,
  openProject,
  renameProject,
  renameProjectEntry,
  saveMeta,
  saveProject
} from '../services/projectStore'
import { getAppSettings } from '../services/appSettings'
import type { ProjectMeta } from '../../shared/types'

export function registerProject(): void {
  ipcMain.handle('project:list', async () => listProjects(await getAppSettings()))

  ipcMain.handle('project:new', async (_e, name: string) => newProject(name, await getAppSettings()))

  ipcMain.handle('project:importZip', async (e) => {
    const window = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(window, {
      title: 'Import Zip Project',
      properties: ['openFile'],
      filters: [{ name: 'Zip Archives', extensions: ['zip'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return importProjectZip(result.filePaths[0], await getAppSettings())
  })

  ipcMain.handle('project:open', async (_e, dir: string) => openProject(dir, await getAppSettings()))

  ipcMain.handle('project:rename', async (_e, dir: string, nextName: string) =>
    renameProject(dir, nextName, await getAppSettings())
  )

  ipcMain.handle('project:delete', async (_e, dir: string) => deleteProject(dir))

  ipcMain.handle('project:save', (_e, dir: string, meta: ProjectMeta, source: string) =>
    saveProject(dir, meta, source)
  )

  ipcMain.handle('project:saveMeta', (_e, dir: string, meta: ProjectMeta) => saveMeta(dir, meta))

  ipcMain.handle(
    'project:renameEntry',
    (_e, dir: string, meta: ProjectMeta, source: string, nextEntry: string) =>
      renameProjectEntry(dir, meta, source, nextEntry)
  )
}
