import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../shared/ray-event'

/**
 * electron-updater ships as CommonJS, so under this project's ESM it has to be
 * destructured off the default export rather than imported by name.
 */
const { autoUpdater } = electronUpdater

/** How long "you are up to date" stays up before the banner steps aside again. */
const UP_TO_DATE_MS = 4_000

const IDLE: UpdateStatus = { phase: 'idle', version: null, percent: 0, error: null }

/**
 * Watches GitHub releases for a newer build and reports what it finds.
 *
 * Nothing downloads on its own: the app says an update exists and waits to be
 * asked, so a 130 MB transfer never starts behind someone's back.
 *
 * macOS only installs updates that are signed and notarised, which the release
 * workflow does. An unsigned local build will find the update and fail to apply
 * it, which is why checking is skipped unless the app is packaged.
 */
export class Updater {
  private state: UpdateStatus = IDLE

  /**
   * Whether the check in flight was asked for. The one at startup is silent and
   * says nothing when it finds nothing; a check someone pressed for owes them an
   * answer either way, or the menu item looks broken.
   */
  private asked = false

  private resetting: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly window: () => BrowserWindow | null) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      this.set({ phase: 'available', version: info.version, percent: 0, error: null })
    })

    autoUpdater.on('update-not-available', () => {
      if (!this.asked) {
        this.set(IDLE)

        return
      }

      this.set({ phase: 'up-to-date', version: app.getVersion(), percent: 0, error: null })
      this.resetting = setTimeout(() => this.set(IDLE), UP_TO_DATE_MS)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.set({ ...this.state, phase: 'downloading', percent: Math.round(progress.percent) })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.set({ phase: 'ready', version: info.version, percent: 100, error: null })
    })

    autoUpdater.on('error', (error: Error) => {
      this.set({ ...this.state, phase: 'error', error: error.message })
    })
  }

  current(): UpdateStatus {
    return this.state
  }

  /**
   * `asked` marks a check someone triggered from the menu or the banner, which
   * is the only kind that reports back when there is nothing to report.
   */
  check({ asked = false }: { asked?: boolean } = {}): void {
    // A download in flight, or one already waiting to be installed, is further
    // along than any answer a fresh check could give.
    if (this.state.phase === 'downloading' || this.state.phase === 'ready') {
      return
    }

    this.stopResetting()
    this.asked = asked

    if (!app.isPackaged) {
      if (asked) {
        this.set({ ...IDLE, phase: 'error', error: 'this build is not packaged, so there is nothing to update' })
      }

      return
    }

    if (asked) {
      this.set({ ...IDLE, phase: 'checking' })
    }

    void autoUpdater.checkForUpdates()?.catch(() => undefined)
  }

  download(): void {
    if (this.state.phase !== 'available') {
      return
    }

    this.set({ ...this.state, phase: 'downloading', percent: 0 })
    void autoUpdater.downloadUpdate().catch(() => undefined)
  }

  install(): void {
    if (this.state.phase === 'ready') {
      autoUpdater.quitAndInstall()
    }
  }

  private set(state: UpdateStatus): void {
    this.state = state
    this.window()?.webContents.send('ray:update', state)
  }

  private stopResetting(): void {
    if (this.resetting === null) {
      return
    }

    clearTimeout(this.resetting)
    this.resetting = null
  }
}
