import type { NativeImage } from 'electron'

export type PulseOptions = {
  /** Played in order, one per tick; `rest` is shown again after the last. */
  frames: NativeImage[]
  rest: NativeImage
  /** Puts an image in the menu bar. */
  show: (image: NativeImage) => void
  frameMs: number
}

/**
 * One short fade of the menu bar icon when events arrive.
 *
 * A single request can send a hundred payloads, and a menu bar that blinks
 * for each of them is worse than one that never moves. So a pulse that is
 * already playing absorbs whatever arrives during it: a burst costs one pulse,
 * and a steady trickle pulses at most once per pulse length.
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
      this.timer = null
      this.options.show(this.options.rest)

      return
    }

    this.options.show(frame)
    this.timer = setTimeout(() => this.step(index + 1), this.options.frameMs)
  }
}
