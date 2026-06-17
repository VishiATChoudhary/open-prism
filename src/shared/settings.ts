import type { Provider, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = { provider: 'claude', model: '' }

export function normalizeProvider(provider: unknown): Provider {
  if (provider === 'codex' || provider === 'chatgpt') return 'codex'
  return 'claude'
}

export function normalizeSettings(settings: unknown, fallback: Settings = DEFAULT_SETTINGS): Settings {
  const value = settings && typeof settings === 'object' ? settings : {}
  const provider = 'provider' in value ? value.provider : fallback.provider
  const model = 'model' in value && typeof value.model === 'string' ? value.model : fallback.model

  return {
    provider: normalizeProvider(provider),
    model
  }
}
