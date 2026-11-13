import { Tray, type Menu, type Rectangle } from 'electron'
import { Pulse } from './pulse'
import type { TrayImages } from './tray-images'

/** Six frames at this pace make a pulse of a little under a second. */
const PULSE_FRAME_MS = 120

/** The icon then rests at least this long, however busy the stream is. */
const PULSE_QUIET_MS = 1_200

export type MenuBarOptions = {
  images: TrayImages
  /**
   * Opened by a right click, and built for that click: the pause and the
   * update it shows change while the icon sits there.
   */
  menu: () => Menu
  /**
   * A left click. Where the icon sits is read through `bounds()` rather than
   * handed over, because what the click does first — clearing the count — can
   * move the icon.
   */
  onLeftClick: () => void
}

/**
 * The NetOS Debug icon in the macOS menu bar.
 *
 * Left and right click do different things, so the menu is popped up by hand
 * on a right click. `setContextMenu` would be shorter, but on macOS it takes
 * over the left click too, and the left click belongs to the panel.
 */
export class MenuBar {
  private readonly tray: Tray
  private readonly pulser: Pulse
  private readonly images: TrayImages
  private paused = false

  constructor(options: MenuBarOptions) {
    this.images = options.images
    this.tray = new Tray(options.images.rest)
    this.tray.setToolTip('NetOS Debug')

    this.pulser = new Pulse({
      frames: options.images.pulse,
      rest: options.images.rest,
      show: (image) => this.tray.setImage(image),
      frameMs: PULSE_FRAME_MS,
      quietMs: PULSE_QUIET_MS,
    })

    this.tray.on('click', () => options.onLeftClick())
    this.tray.on('right-click', () => this.tray.popUpContextMenu(options.menu()))
  }

  /** Where the icon sits now, so a panel can drop below it. */
  bounds(): Rectangle {
    return this.tray.getBounds()
  }

  /** The text beside the icon; empty leaves the icon on its own. */
  setTitle(title: string): void {
    // Digits of one width, so a count going from 9 to 10 does not shuffle
    // every icon to its left.
    this.tray.setTitle(title, { fontType: 'monospacedDigit' })
  }

  /** Something arrived for the stream. Ignored while paused: paused is quiet. */
  pulse(): void {
    if (this.paused) {
      return
    }

    this.pulser.play()
  }

  /**
   * Dims the icon while the stream is paused, and brings it back on resume. A
   * pulse under way is cut short, so it cannot put the full icon back over the
   * dimmed one when it ends.
   */
  setPaused(paused: boolean): void {
    if (paused === this.paused) {
      return
    }

    this.paused = paused
    this.pulser.stop()
    this.tray.setImage(paused ? this.images.paused : this.images.rest)
  }

  /** Called on quit so a pending pulse frame cannot land on a destroyed tray. */
  stop(): void {
    this.pulser.stop()
  }

  /** Takes the icon out of the menu bar, for when the setting is switched off. */
  destroy(): void {
    this.pulser.stop()
    this.tray.destroy()
  }
}
