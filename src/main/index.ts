import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { ServerStatus } from '../shared/ray-event'
import { createRayServer } from './ray-server'
import { toRayEvents } from './to-ray-events'

// 0.0.0.0 so a Laravel container can reach the app over host.docker.internal.
const HOST = process.env.RAY_HOST ?? '0.0.0.0'
const PORT = Number(process.env.RAY_PORT ?? 23517)

let mainWindow: BrowserWindow | null = null
let status: ServerStatus = { listening: false, host: HOST, port: PORT, error: null }

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 780,
    show: false,
    title: 'NetOS Ray',
    backgroundColor: '#16161a',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  window.on('ready-to-show', () => window.show())

  // Dumps can contain links; open them in the real browser, not in the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)

    return { action: 'deny' }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL

  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  mainWindow = createWindow()

  ipcMain.handle('ray:status', () => status)

  const server = createRayServer({
    host: HOST,
    port: PORT,
    onRequest: (request) => {
      for (const event of toRayEvents(request)) {
        mainWindow?.webContents.send('ray:event', event)
      }
    },
  })

  server.on('listening', () => {
    status = { ...status, listening: true, error: null }
    mainWindow?.webContents.send('ray:status', status)
  })

  server.on('error', (error: Error) => {
    status = { ...status, listening: false, error: error.message }
    mainWindow?.webContents.send('ray:status', status)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
