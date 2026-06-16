import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc/register'
import { ensureOpenPrismRoot } from './services/projectStore'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: join(app.getAppPath(), 'resources/app-icon.png'),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.on('ready-to-show', () => win.show())
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await ensureOpenPrismRoot()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
