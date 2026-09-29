import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { ServerStatus } from '../shared/ray-event'
import type { StreamStart } from './exec/run-stream'
import type { Snippet, TinkerRequest } from '../shared/tinker'
import { applyDockIcon, windowIcon } from './app-icon'
import { Clients } from './clients'
import { EventLog } from './event-log'
import { McpPresence } from './mcp-status'
import { applyMenu } from './menu'
import { Preferences } from './preferences'
import { createRayServer } from './ray-server'
import { Snippets } from './snippets'
import { Streams } from './exec/run-stream'
import { artisanCommands } from './tools/artisan'
import { queueReport } from './tools/queues'
import { appRoutes } from './tools/routes'
import { schemaTables } from './tools/schema'
import { scoutIndexes } from './tools/scout'
import { testFiles } from './tools/tests'
import { containerProcesses } from './tools/worker-processes'
import { listContainers } from './exec/containers'
import { classIndex } from './tinker/class-index'
import { Tinker } from './tinker/tinker'
import { toRayEvents } from './to-ray-events'
import { Updater } from './updater'

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
let snippets: Snippets
const updater = new Updater(() => mainWindow)
const tinker = new Tinker()
const streams = new Streams(() => mainWindow)

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
  snippets = new Snippets()

  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
  })

  applyDockIcon()
  applyMenu(updater)

  mainWindow = createWindow()

  ipcMain.handle('ray:status', () => status)
  ipcMain.handle('ray:clients', () => clients.list())
  ipcMain.handle('ray:mcp', () => presence.status())
  ipcMain.handle('ray:update', () => updater.current())

  // Always on someone's behalf: the menu item and the banner's Try again are
  // the only callers, and both want an answer even when there is no update.
  ipcMain.on('ray:update:check', () => updater.check({ asked: true }))
  ipcMain.on('ray:update:download', () => updater.download())
  ipcMain.on('ray:update:install', () => updater.install())

  // Once the window is up, so a check can never delay showing it.
  mainWindow.once('ready-to-show', () => updater.check())

  // Tinker runs arbitrary PHP, so it lives on IPC and nowhere else. The ray
  // server binds 0.0.0.0 so containers can post to it; the same endpoint there
  // would hand code execution to anything on the network.
  ipcMain.handle('tinker:containers', () => tinker.containers())

  ipcMain.handle('tinker:tenants', (_event, containerId: string, workingDir: string) =>
    tinker.tenants(containerId, workingDir),
  )

  ipcMain.handle('tinker:run', (_event, request: TinkerRequest) => tinker.run(request))

  ipcMain.handle('tinker:classes', (_event, containerId: string, workingDir: string) =>
    classIndex(containerId, workingDir),
  )

  ipcMain.handle('tools:artisan', (_event, containerId: string, workingDir: string) =>
    artisanCommands(containerId, workingDir),
  )

  ipcMain.handle(
    'tools:scout',
    (_event, containerId: string, workingDir: string, tenant: string) =>
      scoutIndexes(containerId, workingDir, tenant),
  )

  ipcMain.handle('tools:routes', (_event, containerId: string, workingDir: string) =>
    appRoutes(containerId, workingDir),
  )

  ipcMain.handle(
    'tools:schema',
    (_event, containerId: string, workingDir: string, tenant: string) =>
      schemaTables(containerId, workingDir, tenant),
  )

  ipcMain.handle('tools:tests', (_event, containerId: string, workingDir: string) =>
    testFiles(containerId, workingDir),
  )

  ipcMain.handle('tools:queues', (_event, containerId: string, workingDir: string) =>
    queueReport(containerId, workingDir),
  )

  // Horizon reports what it started. What it failed to reap only shows up in
  // the containers themselves, so this asks every running one.
  ipcMain.handle('tools:processes', async (_event, liveMasters: string[]) =>
    containerProcesses(
      (await listContainers()).filter((container) => container.running),
      liveMasters,
    ),
  )

  // Long-running commands push their output instead of resolving with it, so a
  // log tail and a migration both report while they work.
  ipcMain.handle('exec:start', (_event, start: StreamStart) => streams.start(start))

  ipcMain.on('exec:stop', (_event, id: string) => streams.stop(id))

  ipcMain.on('ray:always-on-top', (_event, onTop: boolean) => {
    mainWindow?.setAlwaysOnTop(onTop)
  })

  // Synchronous so the renderer can paint with the stored theme straight away
  // instead of flashing the default first.
  ipcMain.on('ray:prefs:read', (event) => {
    event.returnValue = preferences.all()
  })

  ipcMain.on('tinker:snippets:read', (event) => {
    event.returnValue = snippets.all()
  })

  ipcMain.on('tinker:snippets:write', (_event, list: Snippet[]) => {
    snippets.replace(list)
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

app.on('before-quit', () => {
  preferences?.flush()
  snippets?.flush()
  streams.stopAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
