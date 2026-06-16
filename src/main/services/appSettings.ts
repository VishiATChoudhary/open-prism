import { join } from 'path'
import { promises as fs } from 'fs'
import type { Settings } from '../../shared/types'
import { ensureOpenPrismRoot, openPrismRoot } from './projectStore'

const DEFAULT: Settings = { provider: 'claude', model: '' }

function settingsPath(): string {
  return join(openPrismRoot(), 'settings.json')
}

export async function getAppSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8')
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT }
  }
}

export async function setAppSettings(s: Settings): Promise<void> {
  await ensureOpenPrismRoot()
  await fs.writeFile(settingsPath(), JSON.stringify(s, null, 2), 'utf8')
}
