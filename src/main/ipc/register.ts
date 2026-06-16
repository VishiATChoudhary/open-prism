import { registerSettings } from './settings'
import { registerProject } from './project'
import { registerFile } from './file'
import { registerCompile } from './compile'
import { registerAi } from './ai'

export function registerIpc(): void {
  registerSettings()
  registerProject()
  registerFile()
  registerCompile()
  registerAi()
}
