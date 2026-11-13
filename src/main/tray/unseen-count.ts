import { isStreamEntry, type RayEvent } from '../../shared/ray-event'

export type UnseenState = {
  /** Stream events that arrived while nobody was looking. */
  count: number
  /** Whether an exception is among them. */
  error: boolean
}

export type UnseenCountOptions = {
  /** The panel is open, or the main window has focus. */
  isLooking: () => boolean
  isPaused: () => boolean
  onChange: (state: UnseenState) => void
}

const NONE: UnseenState = { count: 0, error: false }

/**
 * How much arrived in the stream while you were not looking, for the number
 * beside the menu bar icon.
 *
 * Only what the stream lists counts, so the number never disagrees with it:
 * requests, outgoing calls and annotations are left out. While the stream is
 * paused nothing is seen — the lists hold it back — so it counts whoever is
 * looking, and looking does not clear it until the stream runs again.
 */
export class UnseenCount {
  private state: UnseenState = NONE

  constructor(private readonly options: UnseenCountOptions) {}

  current(): UnseenState {
    return this.state
  }

  arrived(events: RayEvent[]): void {
    if (this.options.isLooking() && !this.options.isPaused()) {
      return
    }

    const counted = events.filter(isStreamEntry)

    if (counted.length === 0) {
      return
    }

    this.update({
      count: this.state.count + counted.length,
      error: this.state.error || counted.some((event) => event.type === 'exception'),
    })
  }

  /** The panel opened or the window came forward. */
  looked(): void {
    if (!this.options.isPaused()) {
      this.update(NONE)
    }
  }

  /** What was held back is in the lists now, and seen if someone is looking. */
  resumed(): void {
    if (this.options.isLooking()) {
      this.update(NONE)
    }
  }

  /** Whatever was counted is gone from the stream, so it is not worth a number. */
  cleared(): void {
    this.update(NONE)
  }

  private update(next: UnseenState): void {
    if (next.count === this.state.count && next.error === this.state.error) {
      return
    }

    this.state = next
    this.options.onChange(next)
  }
}
