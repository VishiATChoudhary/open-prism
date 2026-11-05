import { beforeEach, describe, expect, it } from 'vitest'
import { useProject } from '../src/renderer/state/useProject'
import { DEFAULT_SETTINGS } from '../src/shared/settings'
import type { ProjectMeta } from '../src/shared/types'

function projectMeta(entry: string): ProjectMeta {
  return { entry, settings: DEFAULT_SETTINGS, chatHistory: [] }
}

describe('useProject path handling', () => {
  beforeEach(() => {
    useProject.getState().clearProject()
  })

  it('builds a Windows entry path with backslashes', () => {
    useProject.getState().loadProject({
      dir: 'C:\\proj',
      meta: projectMeta('main.tex'),
      source: 'hello'
    })

    const st = useProject.getState()
    expect(st.entryPath).toBe('C:\\proj\\main.tex')
    expect(st.activePath).toBe('C:\\proj\\main.tex')
    expect(st.openFiles).toEqual([
      { path: 'C:\\proj\\main.tex', name: 'main.tex', content: 'hello', dirty: false }
    ])
  })

  it('builds a POSIX entry path with forward slashes', () => {
    useProject.getState().loadProject({
      dir: '/proj',
      meta: projectMeta('main.tex'),
      source: 'hello'
    })

    const st = useProject.getState()
    expect(st.entryPath).toBe('/proj/main.tex')
    expect(st.activePath).toBe('/proj/main.tex')
    expect(st.openFiles[0].path).toBe('/proj/main.tex')
  })

  it('normalizes a nested Windows entry and renames it consistently', () => {
    const store = useProject.getState()
    store.loadProject({
      dir: 'C:\\proj',
      meta: projectMeta('sub/main.tex'),
      source: 'nested'
    })

    let st = useProject.getState()
    expect(st.entryPath).toBe('C:\\proj\\sub\\main.tex')
    expect(st.activePath).toBe('C:\\proj\\sub\\main.tex')
    expect(st.openFiles).toEqual([
      { path: 'C:\\proj\\sub\\main.tex', name: 'main.tex', content: 'nested', dirty: false }
    ])

    store.renameOpen('C:\\proj\\sub\\main.tex', 'C:\\proj\\sub\\intro.tex')

    st = useProject.getState()
    expect(st.entryPath).toBe('C:\\proj\\sub\\intro.tex')
    expect(st.activePath).toBe('C:\\proj\\sub\\intro.tex')
    expect(st.openFiles).toEqual([
      { path: 'C:\\proj\\sub\\intro.tex', name: 'intro.tex', content: 'nested', dirty: false }
    ])
  })

  it('updates the entry, matching tabs and the active tab when renaming a Windows entry', () => {
    const store = useProject.getState()
    store.loadProject({ dir: 'C:\\proj', meta: projectMeta('main.tex'), source: 'main' })
    store.openTab({ path: 'C:\\proj\\sub\\chapter.tex', content: 'chapter' })
    store.activateTab('C:\\proj\\main.tex')
    store.renameOpen('C:\\proj\\main.tex', 'C:\\proj\\intro.tex')

    const st = useProject.getState()
    expect(st.entryPath).toBe('C:\\proj\\intro.tex')
    expect(st.activePath).toBe('C:\\proj\\intro.tex')
    expect(st.openFiles.map((f) => f.path)).toEqual([
      'C:\\proj\\intro.tex',
      'C:\\proj\\sub\\chapter.tex'
    ])
    expect(st.openFiles.map((f) => f.name)).toEqual(['intro.tex', 'chapter.tex'])
    expect(st.openFiles[1].content).toBe('chapter')
  })

  it('rewrites nested Windows tabs when a parent directory is renamed', () => {
    const store = useProject.getState()
    store.loadProject({ dir: 'C:\\proj', meta: projectMeta('main.tex'), source: 'main' })
    store.openTab({ path: 'C:\\proj\\sub\\chapter.tex', content: 'chapter' })
    store.renameOpen('C:\\proj\\sub', 'C:\\proj\\chapters')

    const st = useProject.getState()
    expect(st.entryPath).toBe('C:\\proj\\main.tex')
    expect(st.openFiles.map((f) => f.path)).toEqual([
      'C:\\proj\\main.tex',
      'C:\\proj\\chapters\\chapter.tex'
    ])
    expect(st.openFiles[1].name).toBe('chapter.tex')
  })

  it('renaming a sibling prefix does not affect the project entry', () => {
    const store = useProject.getState()
    store.loadProject({ dir: 'C:\\proj', meta: projectMeta('main.tex'), source: 'main' })
    store.openTab({ path: 'C:\\proj2\\other.tex', content: 'other' })
    store.renameOpen('C:\\proj2', 'C:\\archive')

    const st = useProject.getState()
    expect(st.entryPath).toBe('C:\\proj\\main.tex')
    expect(st.openFiles.map((f) => f.path)).toEqual([
      'C:\\proj\\main.tex',
      'C:\\archive\\other.tex'
    ])
  })
})
