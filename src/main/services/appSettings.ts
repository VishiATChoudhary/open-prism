import { join } from 'path'
import { promises as fs } from 'fs'
import type { Settings } from '../../shared/types'
import { DEFAULT_SETTINGS, normalizeSettings } from '../../shared/settings'
import { ensureOpenPrismRoot, openPrismRoot } from './projectStore'

function settingsPath(): string {
  return join(openPrismRoot(), 'settings.json')
}

export async function getAppSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8')
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function setAppSettings(s: Settings): Promise<void> {
  await ensureOpenPrismRoot()
  await fs.writeFile(settingsPath(), JSON.stringify(normalizeSettings(s), null, 2), 'utf8')
}
