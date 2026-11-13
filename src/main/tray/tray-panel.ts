import { BrowserWindow, screen, type Rectangle } from 'electron'
import { panelPosition } from './panel-position'

const SIZE = { width: 380, height: 480 }

/**
 * How recently a blur may have closed the panel for a click on the icon to
 * count as the one that caused it.
 *
 * Clicking the icon while the panel is open first takes focus away from the
 * panel, which hides it, and only then reports the click. Without this the
 * click would open the panel straight back up, and the icon could never close
 * what it opened.
 */
const REOPEN_GUARD_MS = 250

export type TrayPanelOptions = {
  preload: string
  /** Loads the panel's page into its window. */
  load: (window: BrowserWindow) => void
}

/**
 * The small window a left click on the menu bar icon drops down.
 *
 * Built on first use and then kept, hidden, rather than built per click: it
 * opens instantly, and it stays subscribed to the stream while hidden, so it
 * is already up to date when it appears.
 */
export class TrayPanel {
  private panel: BrowserWindow | null = null
  private hiddenAt = 0

  constructor(private readonly options: TrayPanelOptions) {}

  toggle(anchor: Rectangle): void {
    const existing = this.window()

    if (existing?.isVisible()) {
      this.hide()

      return
    }

    if (Date.now() - this.hiddenAt < REOPEN_GUARD_MS) {
      return
    }

    if (existing) {
      this.showAt(existing, anchor)

      return
    }

    // A window shown before its page has painted flashes empty; the first one
    // waits for its page.
    const created = this.create()

    created.once('ready-to-show', () => this.showAt(created, anchor))
  }

  hide(): void {
    const panel = this.window()

    if (panel?.isVisible()) {
      this.hiddenAt = Date.now()
      panel.hide()
    }
  }

  /** Whether the panel is on screen, which counts as looking at the stream. */
  isVisible(): boolean {
    return this.window()?.isVisible() ?? false
  }

  /** The panel's window, or null when it was never built or is gone. */
  window(): BrowserWindow | null {
    return this.panel !== null && !this.panel.isDestroyed() ? this.panel : null
  }

  private showAt(panel: BrowserWindow, anchor: Rectangle): void {
    const { workArea } = screen.getDisplayMatching(anchor)

    panel.setBounds({ ...panelPosition(anchor, SIZE, workArea), ...SIZE })
    panel.show()
    panel.focus()
  }

  private create(): BrowserWindow {
    const panel = new BrowserWindow({
      ...SIZE,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      // An NSPanel: it floats over full-screen apps the way a menu does.
      ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
      webPreferences: {
        preload: this.options.preload,
        contextIsolation: true,
        sandbox: false,
      },
    })

    // Over full-screen apps and on every Space, like a menu. Without
    // skipTransformProcessType, macOS turns the whole app into a background
    // agent to allow this, and the Dock icon disappears.
    panel.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    })

    // A click anywhere else closes it, the way a menu closes.
    panel.on('blur', () => this.hide())

    this.options.load(panel)
    this.panel = panel

    return panel
  }
}
