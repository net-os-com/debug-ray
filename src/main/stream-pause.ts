import type { PauseState } from '../shared/pause-state'

/**
 * The stream's one pause, wherever it was started: the window's toolbar, the
 * command palette or the menu bar.
 *
 * It used to live in the window, which made it die with the window and left
 * the menu bar unable to see or change it. Here it also decides what stays
 * quiet while it holds — see where `isPaused` is read.
 *
 * Not persisted: every launch starts with the stream running.
 */
export class StreamPause {
  private current: PauseState = { paused: false, since: null }

  constructor(private readonly onChange: (state: PauseState) => void) {}

  state(): PauseState {
    return this.current
  }

  isPaused(): boolean {
    return this.current.paused
  }

  /**
   * Pausing what is already paused keeps the first `since`, so a second click
   * cannot move the line between what was shown and what is waiting.
   */
  set(paused: boolean, now: number = Date.now()): void {
    if (paused === this.current.paused) {
      return
    }

    this.current = { paused, since: paused ? now : null }
    this.onChange(this.current)
  }
}
