import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { ServerStatus } from '../shared/ray-event'
import type { StreamStart } from './exec/run-stream'
import type { Snippet, TinkerRequest } from '../shared/tinker'
import type { ApiEnvironment, ApiSend, SavedRequest } from '../shared/api'
import { applyDockIcon, windowIcon } from './app-icon'
import { Clients } from './clients'
import { EventLog } from './event-log'
import { isIgnored } from './ignore-sources'
import { Notifier } from './notifier'
import { openInEditor } from './open-in-editor'
import { McpPresence } from './mcp-status'
import { applyMenu } from './menu'
import { Preferences } from './preferences'
import { readSettings } from './settings'
import { createRayServer } from './ray-server'
import { Snippets } from './snippets'
import { Environments } from './api/environments'
import { send } from './api/send'
import { mintToken, revokeTokens, searchUsers } from './api/impersonate'
import {
  forgetInCollection,
  listCollections,
  readCollection,
  saveToCollection,
} from './api/collections'
import { Streams } from './exec/run-stream'
import { artisanCommands } from './tools/artisan'
import { queueReport } from './tools/queues'
import { appRoutes } from './tools/routes'
import { routeContexts } from './tools/route-context'
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
let quitting = false
let status: ServerStatus = { listening: false, host: HOST, port: PORT, error: null }

const clients = new Clients()
const log = new EventLog()
const presence = new McpPresence()
let preferences: Preferences
let snippets: Snippets
let environments: Environments
const updater = new Updater(() => mainWindow)
const tinker = new Tinker()
const streams = new Streams(() => mainWindow)
const notifier = new Notifier({
  isFocused: () => mainWindow?.isFocused() ?? false,
  onActivate: () => {
    mainWindow?.show()
    mainWindow?.focus()
  },
  coalesceMs: () => readSettings(preferences).notificationCoalesceMs,
  sound: () => readSettings(preferences).notificationSound,
})

/**
 * Mirrors the "Launch at login" setting into the OS. Reading from preferences
 * rather than taking an argument keeps the one source of truth in one place.
 */
function applyLoginItem(): void {
  const { launchAtLogin } = readSettings(preferences)

  if (app.getLoginItemSettings().openAtLogin !== launchAtLogin) {
    app.setLoginItemSettings({ openAtLogin: launchAtLogin })
  }
}

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

  // Backs "Close to background": the receiver is the point of the app, so
  // closing the window can mean putting it away rather than shutting it down.
  // `quitting` distinguishes a real quit, where the close must go through.
  window.on('close', (event) => {
    if (quitting || !readSettings(preferences).closeToBackground) {
      return
    }

    event.preventDefault()
    window.hide()
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
  environments = new Environments()

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

  // Requests go out from here rather than from the renderer: no origin means
  // no CORS, every header is ours to set, and the socket's own events are the
  // only place the real phases of a request can be read.
  ipcMain.handle('api:send', (_event, options: ApiSend) => send(options))

  // The files live in the application's repository and the package owns them,
  // so every read and write goes through its artisan command.
  ipcMain.handle('api:collections', (_event, containerId: string, workingDir: string) =>
    listCollections(containerId, workingDir),
  )

  ipcMain.handle(
    'api:collection',
    (_event, containerId: string, workingDir: string, name: string) =>
      readCollection(containerId, workingDir, name),
  )

  ipcMain.handle(
    'api:collection:save',
    (_event, containerId: string, workingDir: string, name: string, request: SavedRequest) =>
      saveToCollection(containerId, workingDir, name, request),
  )

  ipcMain.handle(
    'api:collection:forget',
    (_event, containerId: string, workingDir: string, name: string, operationId: string) =>
      forgetInCollection(containerId, workingDir, name, operationId),
  )

  ipcMain.handle(
    'api:users',
    (_event, containerId: string, workingDir: string, tenant: string, query: string) =>
      searchUsers(containerId, workingDir, tenant, query),
  )

  // Minting a token for another account is real access, so it stays on IPC
  // like Tinker does and never goes near the receiver the containers can reach.
  ipcMain.handle(
    'api:mint',
    (_event, containerId: string, workingDir: string, tenant: string, userId: string) =>
      mintToken(containerId, workingDir, tenant, userId),
  )

  ipcMain.handle(
    'api:revoke',
    (_event, containerId: string, workingDir: string, tenant: string) =>
      revokeTokens(containerId, workingDir, tenant),
  )

  ipcMain.on('api:environments:read', (event) => {
    event.returnValue = environments.all()
  })

  ipcMain.on('api:environments:write', (_event, list: ApiEnvironment[]) => {
    environments.replace(list)
  })

  ipcMain.handle('tools:routes', (_event, containerId: string, workingDir: string) =>
    appRoutes(containerId, workingDir),
  )

  ipcMain.handle('tools:route-context', (_event, containerId: string, workingDir: string) =>
    routeContexts(containerId, workingDir),
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

    // Login items live with the OS rather than in our file, so the setting has
    // to be pushed there whenever it changes.
    applyLoginItem()
  })

  // Backs "Open files in": the renderer passes the path as the sender wrote it,
  // and main rewrites it to this machine before handing it to the editor.
  ipcMain.handle('ray:open-in-editor', (_event, file: string, line: number) =>
    openInEditor(file, line, readSettings(preferences)),
  )

  ipcMain.on('ray:copy', (_event, text: string) => {
    clipboard.writeText(text)
  })

  // Backs the "Focus on errors" setting; the renderer decides when to ask.
  ipcMain.on('ray:attention', () => {
    mainWindow?.show()
    mainWindow?.flashFrame(true)
  })

  // Backs the "Show notifications" setting. The renderer builds the headline,
  // because eventTitle() lives there; main owns the decision to show it, so the
  // focus check and the burst rate limit have a single home.
  ipcMain.on('ray:notify', (_event, title: string, body: string) => {
    notifier.notify(title, body)
  })

  const server = createRayServer({
    host: HOST,
    port: PORT,
    log,
    presence,
    onRequest: (request, address) => {
      clients.record(request, address)

      const ignored = readSettings(preferences).ignoredSources
      const events = toRayEvents(request).filter((event) => !isIgnored(event, ignored))

      if (events.length === 0) {
        return
      }

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

      return
    }

    // "Close to background" hides the window rather than closing it, so it is
    // still counted above. Without this the dock icon would appear to do
    // nothing and the app would look dead while it was still receiving.
    mainWindow?.show()
    mainWindow?.focus()
  })
})

app.on('browser-window-focus', () => mainWindow?.flashFrame(false))

app.on('before-quit', () => {
  quitting = true

  preferences?.flush()
  snippets?.flush()
  environments?.flush()
  streams.stopAll()
  notifier.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
