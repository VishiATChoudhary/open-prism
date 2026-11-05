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

const { spawnMock, resolveExecutableMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  resolveExecutableMock: vi.fn()
}))

vi.mock('cross-spawn', () => ({ default: spawnMock }))
vi.mock('../src/main/services/spawnEnv', () => ({
  resolveSpawnEnv: async () => process.env,
  resolveExecutable: resolveExecutableMock
}))

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }
}

function fakeChild(): FakeChild {
  const proc = new EventEmitter() as FakeChild
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.stdin = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() })
  return proc
}

describe('runAiCli spawning', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    resolveExecutableMock.mockReset()
  })

  it('spawns without a shell and pipes the prompt to stdin', async () => {
    resolveExecutableMock.mockReturnValue('claude')
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
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    )
    expect(spawnMock.mock.calls[0]?.[2]).not.toHaveProperty('shell')
    expect(child.stdin.write).toHaveBeenCalledWith('hello')
    expect(child.stdin.end).toHaveBeenCalled()
  })

  it('spawns the executable resolved from PATH', async () => {
    resolveExecutableMock.mockReturnValue('C:\\tools\\claude.cmd')
    const child = fakeChild()
    spawnMock.mockReturnValue(child)

    const result = runAiCli('claude', 'sonnet', 'hello', () => {})
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalled())

    child.stdout.emit('data', Buffer.from('ok'))
    child.emit('close', 0)

    await expect(result).resolves.toBe('ok')
    expect(resolveExecutableMock).toHaveBeenCalledWith('claude', process.env)
    expect(spawnMock).toHaveBeenCalledWith(
      'C:\\tools\\claude.cmd',
      ['-p', '--model', 'sonnet'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    )
  })

  it('survives stdin errors when the child exits before reading the prompt', async () => {
    resolveExecutableMock.mockReturnValue('claude')
    const child = fakeChild()
    spawnMock.mockReturnValue(child)

    const result = runAiCli('claude', '', 'x'.repeat(70 * 1024), () => {})
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalled())

    expect(child.stdin.listenerCount('error')).toBeGreaterThan(0)
    expect(() =>
      child.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))
    ).not.toThrow()

    child.emit('close', 1)

    await expect(result).rejects.toThrow('"claude" exited with code 1')
  })

  it.each([
    ['claude', 'Claude: https://docs.claude.com/en/docs/claude-code', 'Codex:'],
    ['codex', 'Codex: https://developers.openai.com/codex/cli', 'Claude:']
  ] as const)(
    'reports only the %s install hint when the CLI cannot be started',
    async (provider, expectedHint, forbiddenHint) => {
      resolveExecutableMock.mockReturnValue(provider)
      const child = fakeChild()
      spawnMock.mockReturnValue(child)

      const result = runAiCli(provider, '', 'hi', () => {})
      await vi.waitFor(() => expect(spawnMock).toHaveBeenCalled())

      child.emit('error', new Error('spawn ENOENT'))

      const error = await result.then(
        () => null,
        (e: Error) => e
      )
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toContain(expectedHint)
      expect(error?.message).not.toContain(forbiddenHint)
    }
  )

  it.each([
    [
      'claude',
      'Claude CLI',
      'Claude: https://docs.claude.com/en/docs/claude-code',
      'Codex:'
    ],
    ['codex', 'Codex CLI', 'Codex: https://developers.openai.com/codex/cli', 'Claude:']
  ] as const)(
    'fails closed without spawning when the %s CLI is not on PATH',
    async (provider, label, expectedHint, forbiddenHint) => {
      resolveExecutableMock.mockReturnValue(null)

      const error = await runAiCli(provider, '', 'hi', () => {}).then(
        () => null,
        (e: Error) => e
      )

      expect(spawnMock).not.toHaveBeenCalled()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toContain(`${label} ("${provider}") was not found on PATH`)
      expect(error?.message).toContain(expectedHint)
      expect(error?.message).not.toContain(forbiddenHint)
    }
  )
})
