import { ipcMain } from 'electron'
import { compile } from '../services/tectonic'

export function registerCompile(): void {
  ipcMain.handle('compile', (_e, dir: string, entry: string) => compile(dir, entry))
}
