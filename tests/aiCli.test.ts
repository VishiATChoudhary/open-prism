import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filterAiCliNoise, runAiCli } from '../src/main/services/aiCli'

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

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock('cross-spawn', () => ({ default: spawnMock }))
vi.mock('../src/main/services/spawnEnv', () => ({
  resolveSpawnEnv: async () => process.env
}))

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }
}

function fakeChild(): FakeChild {
  const proc = new EventEmitter() as FakeChild
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = { write: vi.fn(), end: vi.fn() }
  return proc
}

describe('runAiCli spawning', () => {
  beforeEach(() => spawnMock.mockReset())

  it('spawns without a shell and pipes the prompt to stdin', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)

    const result = runAiCli('claude', '', 'hello', () => {})
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalled())

    child.stdout.emit('data', Buffer.from('answer'))
    child.emit('close', 0)

    await expect(result).resolves.toBe('answer')
    expect(spawnMock).toHaveBeenCalledWith(
      'claude',
      ['-p'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    )
    expect(spawnMock.mock.calls[0]?.[2]).not.toHaveProperty('shell', true)
    expect(child.stdin.write).toHaveBeenCalledWith('hello')
    expect(child.stdin.end).toHaveBeenCalled()
  })
})
