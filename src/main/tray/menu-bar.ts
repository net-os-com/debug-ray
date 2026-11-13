import { Tray, type Menu, type Rectangle } from 'electron'
import { Pulse } from './pulse'
import type { TrayImages } from './tray-images'

/** Six frames at this pace make a pulse of a little under a second. */
const PULSE_FRAME_MS = 120

export type MenuBarOptions = {
  images: TrayImages
  /** Opened by a right click. */
  menu: Menu
  /** A left click, with where the icon sits so a panel can drop below it. */
  onLeftClick: (bounds: Rectangle) => void
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

  constructor(options: MenuBarOptions) {
    this.tray = new Tray(options.images.rest)
    this.tray.setToolTip('NetOS Debug')

    this.pulser = new Pulse({
      frames: options.images.pulse,
      rest: options.images.rest,
      show: (image) => this.tray.setImage(image),
      frameMs: PULSE_FRAME_MS,
    })

    this.tray.on('click', () => options.onLeftClick(this.tray.getBounds()))
    this.tray.on('right-click', () => this.tray.popUpContextMenu(options.menu))
  }

  /** Something arrived for the stream. */
  pulse(): void {
    this.pulser.play()
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
