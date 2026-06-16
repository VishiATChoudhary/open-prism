import { ipcMain } from 'electron'
import { getAppSettings, setAppSettings } from '../services/appSettings'
import type { Settings } from '../../shared/types'

export function registerSettings(): void {
  ipcMain.handle('settings:get', () => getAppSettings())
  ipcMain.handle('settings:set', (_e, s: Settings) => setAppSettings(s))
}
