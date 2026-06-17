import { app, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { basename, extname, join } from 'path'
import {
  copyExternalEntries,
  createEntry,
  deleteEntry,
  moveEntry,
  readTree,
  renameEntry
} from '../services/fileTree'

async function uniqueDownloadsPath(fileName: string): Promise<string> {
  const downloadsDir = app.getPath('downloads')
  const ext = extname(fileName) || '.pdf'
  const base = basename(fileName, ext) || 'document'
  let candidate = join(downloadsDir, `${base}${ext}`)
  let suffix = 2

  while (true) {
    try {
      await fs.access(candidate)
      candidate = join(downloadsDir, `${base}-${suffix}${ext}`)
      suffix += 1
    } catch {
      return candidate
    }
  }
}

export function registerFile(): void {
  ipcMain.handle('file:read', (_e, path: string) => fs.readFile(path, 'utf8'))
  ipcMain.handle('file:readBinary', (_e, path: string) => fs.readFile(path))
  ipcMain.handle('file:write', (_e, path: string, data: string) => fs.writeFile(path, data, 'utf8'))
  ipcMain.handle('file:exportPdf', async (_e, pdfPath: string) => {
    if (extname(pdfPath).toLowerCase() !== '.pdf') {
      throw new Error('Only PDF files can be exported.')
    }

    const targetPath = await uniqueDownloadsPath(basename(pdfPath))
    await fs.copyFile(pdfPath, targetPath)
    return targetPath
  })

  ipcMain.handle('file:tree', (_e, dir: string) => readTree(dir))
  ipcMain.handle('file:create', (_e, path: string, isDir: boolean) => createEntry(path, isDir))
  ipcMain.handle('file:delete', (_e, path: string) => deleteEntry(path))
  ipcMain.handle('file:rename', (_e, path: string, nextName: string) => renameEntry(path, nextName))
  ipcMain.handle('file:move', (_e, path: string, targetDir: string) => moveEntry(path, targetDir))
  ipcMain.handle('file:copyExternal', (_e, paths: string[], targetDir: string) =>
    copyExternalEntries(paths, targetDir)
  )
}
