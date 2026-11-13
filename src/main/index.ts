import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { isStreamEntry, type ServerStatus } from '../shared/ray-event'
import type { StreamStart } from './exec/run-stream'
import type { Snippet, TinkerRequest } from '../shared/tinker'
import type { ApiEnvironment, ApiSend, SavedRequest } from '../shared/api'
import { applyDockIcon, windowIcon } from './app-icon'
import { Clients } from './clients'
import { EventLog } from './event-log'
import { isIgnored } from './ignore-sources'
import { Notifier } from './notifier'
import type { ErdPoint, ErdSticky } from '../shared/erd'
import { schemaFromMigrations } from './erd/migrations'
import { readErd, saveErd } from './erd/store'
import { openInEditor } from './open-in-editor'
import { saveFile, type SaveRequest } from './save-file'
import { McpPresence } from './mcp-status'
import { sendToWindow, sendToWindows } from './send-to-window'
import { applyMenu } from './menu'
import { Preferences } from './preferences'
import { readSettings } from './settings'
import { createRayServer } from './ray-server'
import { Snippets } from './snippets'
import { Environments } from './api/environments'
import { send } from './api/send'
import { broadcast } from './realtime/broadcast'
import { readCredentials } from './realtime/credentials'
import { broadcastEvents } from './realtime/events'
import { occupiedChannels } from './realtime/occupied'
import { RealtimeSession, type RealtimeContext } from './realtime/session'
import { mintToken, revokeTokens, searchUsers } from './api/impersonate'
import {
  forgetInCollection,
  importIntoCollection,
  listCollections,
  readCollection,
  saveToCollection,
} from './api/collections'
import { importFile } from './api/import-file'
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
import { StreamPause } from './stream-pause'
import { Updater } from './updater'
import { WindowIntents } from './window-intents'
import { MenuBar } from './tray/menu-bar'
import { buildTrayMenu } from './tray/tray-menu'
import { trayTitle } from './tray/tray-title'
import { UnseenCount } from './tray/unseen-count'
import { loadTrayImages } from './tray/tray-images'
import { TrayPanel } from './tray/tray-panel'
import { loadRendererPage } from './renderer-page'

// Unpackaged, Electron names the app after its own binary; the default menu is
// built from app.name on ready, so this has to happen at load time.
app.setName('NetOS Debug')

// 0.0.0.0 so a Laravel container can reach the app over host.docker.internal.
const HOST = process.env.RAY_HOST ?? '0.0.0.0'
const PORT = Number(process.env.RAY_PORT ?? 23517)

let mainWindow: BrowserWindow | null = null
const intents = new WindowIntents(() => mainWindow)
// Held here for the life of the app: a Tray only a local variable points at is
// garbage-collected, and the icon quietly disappears from the menu bar.
let menuBar: MenuBar | null = null

const PRELOAD = join(import.meta.dirname, '../preload/index.mjs')

// The menu bar panel shares the main window's preload: it shows titles only,
// never payload HTML, and everything it needs is already on window.ray.
const panel = new TrayPanel({
  preload: PRELOAD,
  load: (window) => loadRendererPage(window, 'tray'),
})
let quitting = false
let status: ServerStatus = { listening: false, host: HOST, port: PORT, error: null }

const clients = new Clients()
// `preferences` is only assigned once the app is ready, but the log is only
// written to by the receiver, which starts after that, so reading it lazily
// here is safe.
const log = new EventLog(() => readSettings(preferences).eventBuffer)
const presence = new McpPresence()
let preferences: Preferences
let snippets: Snippets
let environments: Environments
const updater = new Updater(() => mainWindow)
// One pause for the whole app, so the window, the panel and the menu bar agree
// on it, and it outlives a closed window.
const pause = new StreamPause((state) => {
  sendToWindows(streamWindows(), 'ray:pause', state)
  menuBar?.setPaused(state.paused)

  if (!state.paused) {
    unseen.resumed()
  }
})
// The number beside the menu bar icon. Looking is the panel being up or the
// window having focus; a hidden or merely visible window does not count.
const unseen = new UnseenCount({
  isLooking: () =>
    panel.isVisible() ||
    (mainWindow !== null && !mainWindow.isDestroyed() && mainWindow.isFocused()),
  isPaused: () => pause.isPaused(),
  onChange: (state) => menuBar?.setTitle(trayTitle(state)),
})
const tinker = new Tinker()
const streams = new Streams(() => mainWindow)

// The socket lives here rather than in the window: the renderer's
// connect-src refuses it, and the token it authorizes with should never
// reach a page that renders other applications' payloads.
const realtime = new RealtimeSession({
  frame: (frame) => sendToWindow(mainWindow, 'realtime:frame', frame),
  status: (status, detail) => sendToWindow(mainWindow, 'realtime:status', status, detail),
})
const notifier = new Notifier({
  // A closed window's reference outlives it, and asking a destroyed window
  // whether it has focus throws. With the menu bar the app now runs windowless
  // for long stretches, so a summary banner's timer can land in that gap.
  isFocused: () => mainWindow !== null && !mainWindow.isDestroyed() && mainWindow.isFocused(),
  onActivate: () => {
    showMainWindow()
  },
  coalesceMs: () => readSettings(preferences).notificationCoalesceMs,
  sound: () => readSettings(preferences).notificationSound,
})

/**
 * The windows that show the stream and the receiver's status, and so are sent
 * every event, status change and clear.
 */
function streamWindows(): Array<BrowserWindow | null> {
  return [mainWindow, panel.window()]
}

/**
 * Empties the stream everywhere: the log, and with it the panel and any MCP
 * client, every window, and the count beside the icon. Cmd-K in the window and
 * Clear Stream in the menu bar both end up here.
 */
function clearStream(): void {
  log.clearStream()
  sendToWindows(streamWindows(), 'ray:stream:cleared')
  unseen.cleared()
}

/**
 * Mirrors the "Show in menu bar" setting: puts the icon up, or takes it and its
 * panel down. Read from preferences like the login item, so switching it in
 * Settings takes effect at once rather than at the next start.
 */
function applyMenuBarIcon(): void {
  const wanted = readSettings(preferences).showMenuBarIcon

  if (!wanted) {
    panel.hide()
    menuBar?.destroy()
    menuBar = null

    return
  }

  if (menuBar !== null) {
    return
  }

  const images = loadTrayImages()

  if (!images) {
    return
  }

  menuBar = new MenuBar({
    images,
    menu: () =>
      buildTrayMenu(
        { paused: pause.isPaused(), update: updater.current() },
        {
          open: () => showMainWindow(),
          settings: () => {
            showMainWindow()
            intents.deliver({ kind: 'show-view', view: 'settings' })
          },
          togglePause: () => pause.set(!pause.isPaused()),
          clearStream,
          downloadUpdate: () => updater.download(),
          installUpdate: () => updater.install(),
          // before-quit sets `quitting`, so "Close to background" lets it through.
          quit: () => app.quit(),
        },
      ),
    onLeftClick: () => {
      // Cleared before the panel is placed: an empty title narrows the item,
      // and bounds read before that would put the panel off-centre.
      if (!panel.isVisible()) {
        unseen.looked()
      }

      if (menuBar !== null) {
        panel.toggle(menuBar.bounds())
      }
    },
  })

  // Switched on mid-session, it starts with what is already waiting, and
  // dimmed if the stream is paused.
  menuBar.setTitle(trayTitle(unseen.current()))
  menuBar.setPaused(pause.isPaused())
}

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

/**
 * Brings the main window forward, building it again if it was closed.
 *
 * With "Close to background" off, closing the window destroys it while the app
 * keeps running — in the menu bar, now. The reference outlives the window, so a
 * plain `mainWindow.show()` would throw "Object has been destroyed". Counting
 * windows instead, as `activate` used to, stopped working once the menu bar
 * panel existed: it is a window too, so the count never reaches zero.
 *
 * Every caller is someone asking for the app — the Dock, a banner, the menu
 * bar — so on macOS the app is made active too; a click in the menu bar does
 * not do that by itself, and the window would open behind whatever had focus.
 */
function showMainWindow(): BrowserWindow {
  if (process.platform === 'darwin') {
    app.focus({ steal: true })
  }

  if (mainWindow === null || mainWindow.isDestroyed()) {
    // A new window shows itself once it is ready to; showing it now would
    // flash an empty frame.
    mainWindow = createWindow()

    return mainWindow
  }

  mainWindow.show()
  mainWindow.focus()

  return mainWindow
}

function createWindow(): BrowserWindow {
  // Whatever is asked of this window has to wait until its renderer listens.
  intents.reset()

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
    // In the header beside the rail, not on it. Three lights are about 52px
    // wide and the rail is 64: inside it they ran from edge to edge with the
    // mark crammed underneath. x clears the rail (8 + 64 + a 16px gap) and y
    // centres them in the 56px header.
    trafficLightPosition: { x: 88, y: 22 },
    webPreferences: {
      preload: PRELOAD,
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

  // Bringing the window forward is looking at what arrived.
  window.on('focus', () => unseen.looked())

  loadRendererPage(window, 'index')

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

  applyMenuBarIcon()

  // Synchronous because the renderer wants it during its first render, and a
  // version that arrives a frame later shows as a blank where a number goes.
  ipcMain.on('ray:version', (event) => {
    event.returnValue = app.getVersion()
  })

  ipcMain.handle('ray:status', () => status)

  // The window takes what was asked of it while it was being built; taking it
  // is also how it says it is listening.
  ipcMain.handle('ray:intent:take', () => intents.take())

  // The toolbar, the palette and the menu bar all pause through here.
  ipcMain.handle('ray:pause', () => pause.state())
  ipcMain.on('ray:pause:set', (_event, paused: boolean) => pause.set(paused === true))

  // Escape in the panel puts it away, as it would a menu.
  ipcMain.on('tray:hide', () => panel.hide())

  // A row clicked in the panel: the panel steps aside and the main window opens
  // on that event, built again first if it was closed.
  ipcMain.on('tray:open-event', (_event, id: string) => {
    panel.hide()
    showMainWindow()
    intents.deliver({ kind: 'select-event', id })
  })

  // A window that opens after events arrived — the panel, or a main window
  // closed and opened again — starts from what the log holds rather than empty.
  ipcMain.handle('ray:stream:snapshot', () => log.streamSnapshot())

  // Every way the window clears the stream comes through here, so the log, and
  // with it the panel and any MCP client, see what the window shows.
  ipcMain.on('ray:stream:clear', () => clearStream())
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

  // The socket itself lives in the renderer, where a WebSocket belongs. Only
  // the three things it cannot do from a file:// origin come through here:
  // reading the application's configuration, asking it to authorize a channel,
  // and asking it to broadcast.
  ipcMain.handle('realtime:credentials', (_event, containerId: string, workingDir: string) =>
    readCredentials(containerId, workingDir),
  )

  ipcMain.handle(
    'realtime:broadcast',
    (
      _event,
      containerId: string,
      workingDir: string,
      tenant: string,
      channel: string,
      event: string,
      payload: string,
    ) => broadcast(containerId, workingDir, tenant, channel, event, payload),
  )

  ipcMain.handle('realtime:events', (_event, containerId: string, workingDir: string) =>
    broadcastEvents(containerId, workingDir),
  )

  ipcMain.handle('realtime:occupied', (_event, containerId: string, workingDir: string) =>
    occupiedChannels(containerId, workingDir),
  )

  ipcMain.handle('realtime:open', (_event, context: RealtimeContext) => realtime.open(context))
  ipcMain.handle('realtime:subscribe', (_event, channel: string) => realtime.subscribe(channel))
  ipcMain.handle('realtime:unsubscribe', (_event, channel: string) => realtime.unsubscribe(channel))
  ipcMain.handle('realtime:close', () => realtime.close())
  ipcMain.handle(
    'realtime:whisper',
    (_event, channel: string, event: string, data: unknown) =>
      realtime.whisper(channel, event, data),
  )

  ipcMain.handle('erd:save-file', (_event, request: SaveRequest) =>
    saveFile(mainWindow, request),
  )

  ipcMain.handle('erd:migrations', (_event, containerId: string, workingDir: string) =>
    schemaFromMigrations(containerId, workingDir),
  )

  ipcMain.handle('erd:read', (_event, containerId: string, workingDir: string) =>
    readErd(containerId, workingDir),
  )

  ipcMain.handle(
    'erd:save',
    (
      _event,
      containerId: string,
      workingDir: string,
      dbml: string,
      layout: Record<string, ErdPoint>,
      stickies: ErdSticky[],
    ) => saveErd(containerId, workingDir, dbml, layout, stickies),
  )

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

  // Reading somebody's export happens here, not in the container: the file is
  // on this machine, and an import should not need a stack to be running.
  ipcMain.handle('api:import:file', () => importFile())

  ipcMain.handle(
    'api:collection:import',
    (_event, containerId: string, workingDir: string, name: string, requests: SavedRequest[]) =>
      importIntoCollection(containerId, workingDir, name, requests),
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

    // Login items live with the OS rather than in our file, and the menu bar
    // icon is an object main owns, so both settings have to be pushed out
    // whenever they change. Both are cheap no-ops when nothing did.
    applyLoginItem()
    applyMenuBarIcon()
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
  // A paused stream is a quiet one: you pause because you are busy elsewhere,
  // and a window jumping forward is the opposite of that. Nothing is replayed
  // on resume; the events themselves are waiting in the list.
  ipcMain.on('ray:attention', () => {
    if (pause.isPaused()) {
      return
    }

    mainWindow?.show()
    mainWindow?.flashFrame(true)
  })

  // Backs the "Show notifications" setting. The renderer builds the headline,
  // because eventTitle() lives there; main owns the decision to show it, so the
  // focus check and the burst rate limit have a single home.
  ipcMain.handle('ray:notify-test', () => notifier.test())

  ipcMain.on('ray:notify', (_event, title: string, body: string) => {
    if (pause.isPaused()) {
      return
    }

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
        unseen.cleared()
      }

      log.record(events)
      unseen.arrived(events)

      for (const event of events) {
        sendToWindows(streamWindows(), 'ray:event', event)
      }

      // Requests, outgoing calls and annotations have views of their own or
      // none; only what the stream would list is worth a glance at the icon.
      if (events.some(isStreamEntry)) {
        menuBar?.pulse()
      }
    },
  })

  server.on('listening', () => {
    status = { ...status, listening: true, error: null }
    sendToWindows(streamWindows(), 'ray:status', status)
  })

  server.on('error', (error: Error) => {
    status = { ...status, listening: false, error: error.message }
    sendToWindows(streamWindows(), 'ray:status', status)
  })

  // The Dock icon brings the window back whether it was hidden by "Close to
  // background" or closed outright. Without this the app would look dead while
  // it was still receiving.
  app.on('activate', () => {
    showMainWindow()
  })
})

// The panel is a window too, and focusing it while the main window is closed
// would otherwise call into a destroyed window.
app.on('browser-window-focus', () => {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.flashFrame(false)
  }
})

app.on('before-quit', () => {
  quitting = true

  preferences?.flush()
  snippets?.flush()
  environments?.flush()
  streams.stopAll()
  notifier.stop()
  menuBar?.stop()
  // The socket outlived the window otherwise, and a frame arriving in that gap
  // was an uncaught exception on the way out.
  realtime.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
