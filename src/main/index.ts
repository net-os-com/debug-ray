import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { ServerStatus } from '../shared/ray-event'
import { applyDockIcon, windowIcon } from './app-icon'
import { Clients } from './clients'
import { EventLog } from './event-log'
import { McpPresence } from './mcp-status'
import { Preferences } from './preferences'
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
const presence = new McpPresence()
let preferences: Preferences

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
    // The brand rail is the title bar; macOS keeps its buttons floating over it.
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 18, y: 17 },
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  window.on('ready-to-show', () => window.show())

  // Full screen hides the traffic lights, so the rail reclaims their gutter.
  const reportFullScreen = (fullScreen: boolean): void => {
    window.webContents.send('ray:fullscreen', fullScreen)
  }

  window.on('enter-full-screen', () => reportFullScreen(true))
  window.on('leave-full-screen', () => reportFullScreen(false))

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
  preferences = new Preferences()

  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
  })

  applyDockIcon()

  mainWindow = createWindow()

  ipcMain.handle('ray:status', () => status)
  ipcMain.handle('ray:clients', () => clients.list())
  ipcMain.handle('ray:mcp', () => presence.status())

  ipcMain.on('ray:always-on-top', (_event, onTop: boolean) => {
    mainWindow?.setAlwaysOnTop(onTop)
  })

  // Synchronous so the renderer can paint with the stored theme straight away
  // instead of flashing the default first.
  ipcMain.on('ray:prefs:read', (event) => {
    event.returnValue = preferences.all()
  })

  ipcMain.on('ray:prefs:write', (_event, patch: Record<string, unknown>) => {
    preferences.merge(patch)
  })

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
    presence,
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

app.on('before-quit', () => preferences?.flush())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
