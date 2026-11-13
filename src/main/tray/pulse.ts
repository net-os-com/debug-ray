import type { NativeImage } from 'electron'

export type PulseOptions = {
  /** Played in order, one per tick; `rest` is shown again after the last. */
  frames: NativeImage[]
  rest: NativeImage
  /** Puts an image in the menu bar. */
  show: (image: NativeImage) => void
  frameMs: number
  /** How long the icon stays still after a pulse before another may start. */
  quietMs: number
}

/**
 * One short fade of the menu bar icon when events arrive.
 *
 * A single request can send a hundred payloads, and a menu bar that blinks
 * for each of them is worse than one that never moves. So a pulse absorbs
 * whatever arrives while it plays and for a quiet spell after it: a burst costs
 * one pulse, and an application that logs every half second gets a pulse now
 * and then with the icon at rest in between, rather than an icon that never
 * stops fading.
 */
export class Pulse {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: PulseOptions) {}

  play(): void {
    if (this.timer !== null) {
      return
    }

    this.step(0)
  }

  /** Called on quit so a pending frame cannot land on a destroyed tray. */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private step(index: number): void {
    const frame = this.options.frames[index]

    if (frame === undefined) {
      this.options.show(this.options.rest)
      // Still busy, as far as play() is concerned, until the quiet spell ends.
      this.timer = setTimeout(() => {
        this.timer = null
      }, this.options.quietMs)

      return
    }

    this.options.show(frame)
    this.timer = setTimeout(() => this.step(index + 1), this.options.frameMs)
  }
}
