import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { ServerStatus } from '../shared/ray-event'
import { applyDockIcon, windowIcon } from './app-icon'
import { Clients } from './clients'
import { EventLog } from './event-log'
import { createRayServer } from './ray-server'
import { toRayEvents } from './to-ray-events'

// Unpackaged, Electron names the app after its own binary; the default menu is
// built from app.name on ready, so this has to happen at load time.
app.setName('NetOS Debug')

// 0.0.0.0 so a Laravel container can reach the app over host.docker.internal.
const HOST = process.env.RAY_HOST ?? '0.0.0.0'
const PORT = Number(process.env.RAY_PORT ?? 23517)

let mainWindow: BrowserWindow | null = null
let status: ServerStatus = { listening: false, host: HOST, port: PORT, error: null }

const clients = new Clients()
const log = new EventLog()

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'NetOS Debug',
    backgroundColor: '#0a2d51',
    icon: windowIcon(),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  window.on('ready-to-show', () => window.show())

  // Dumps and mailables can contain links; open them in the real browser.
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
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
  })

  applyDockIcon()

  mainWindow = createWindow()

  ipcMain.handle('ray:status', () => status)
  ipcMain.handle('ray:clients', () => clients.list())

  ipcMain.on('ray:copy', (_event, text: string) => {
    clipboard.writeText(text)
  })

  // Backs the "Notify on errors" setting; the renderer decides when to ask.
  ipcMain.on('ray:attention', () => {
    mainWindow?.show()
    mainWindow?.flashFrame(true)
  })

  const server = createRayServer({
    host: HOST,
    port: PORT,
    log,
    onRequest: (request, address) => {
      clients.record(request, address)

      const events = toRayEvents(request)

      if (events.some((event) => event.type === 'clear_all')) {
        log.clear()
      }

      log.record(events)

      for (const event of events) {
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

app.on('browser-window-focus', () => mainWindow?.flashFrame(false))

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
