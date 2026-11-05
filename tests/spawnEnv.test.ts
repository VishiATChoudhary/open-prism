import { describe, expect, it } from 'vitest'
import { buildSpawnPath } from '../src/main/services/spawnEnv'

describe('buildSpawnPath', () => {
  it('merges Windows dirs with semicolons and case-insensitive dedupe', () => {
    const result = buildSpawnPath({
      platform: 'win32',
      envPath: 'C:\\Windows;C:\\Tools;c:\\tools',
      home: 'C:\\Users\\me',
      env: {
        APPDATA: 'C:\\Users\\me\\AppData\\Roaming',
        ProgramData: 'C:\\ProgramData'
      }
    })

    expect(result.split(';')).toEqual([
      'C:\\Windows',
      'C:\\Tools',
      'C:\\Users\\me\\.local\\bin',
      'C:\\Users\\me\\AppData\\Roaming\\npm',
      'C:\\Users\\me\\.cargo\\bin',
      'C:\\Users\\me\\scoop\\shims',
      'C:\\ProgramData\\chocolatey\\bin'
    ])
  })

  it('keeps the POSIX login-shell PATH first and uses colons', () => {
    const result = buildSpawnPath({
      platform: 'darwin',
      envPath: '/usr/bin:/bin',
      home: '/Users/me',
      env: {},
      loginShellPath: '/opt/homebrew/bin:/usr/local/bin'
    })

    expect(result.split(':').slice(0, 4)).toEqual([
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin'
    ])
    expect(result).toContain('/Users/me/.local/bin')
  })
})
