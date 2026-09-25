import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../shared/ray-event'

/**
 * electron-updater ships as CommonJS, so under this project's ESM it has to be
 * destructured off the default export rather than imported by name.
 */
const { autoUpdater } = electronUpdater

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
  private state: UpdateStatus = { phase: 'idle', version: null, percent: 0, error: null }

  constructor(private readonly window: () => BrowserWindow | null) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      this.set({ phase: 'available', version: info.version, percent: 0, error: null })
    })

    autoUpdater.on('update-not-available', () => {
      this.set({ phase: 'idle', version: null, percent: 0, error: null })
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

  /** Silent by design: a failed check is not worth interrupting anyone over. */
  check(): void {
    if (!app.isPackaged) {
      return
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
}
