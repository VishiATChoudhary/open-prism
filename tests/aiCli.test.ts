import { describe, expect, it } from 'vitest'
import { filterAiCliNoise } from '../src/main/services/aiCli'

describe('filterAiCliNoise', () => {
  it('removes known Codex CLI node circular dependency warnings', () => {
    const input = [
      "(node:55669) Warning: Accessing non-existent property 'lineno' of module exports inside circular dependency",
      '(Use `node --trace-warnings ...` to show where the warning was created)',
      'thinking',
      "(node:55669) Warning: Accessing non-existent property 'filename' of module exports inside circular dependency",
      'answer'
    ].join('\n')

    expect(filterAiCliNoise(input)).toBe('thinking\nanswer')
  })

  it('keeps unrelated stderr output', () => {
    expect(filterAiCliNoise('codex failed: missing auth\n')).toBe('codex failed: missing auth\n')
  })
})
