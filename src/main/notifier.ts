import { Notification } from 'electron'

export type NotifierOptions = {
  /** Whether the window is in the foreground; nothing is shown when it is. */
  isFocused: () => boolean
  /** Called when the person clicks a banner. */
  onActivate: () => void
  /**
   * How long after a notification further events are folded into a summary
   * rather than each getting a banner. One request can send a hundred payloads;
   * at 0 every event gets its own banner. Read per use so a change in the
   * window takes effect at once.
   */
  coalesceMs: () => number
  /** Whether the system sound plays with each banner. */
  sound: () => boolean
}

/**
 * Posts macOS notifications for arriving stream events.
 *
 * The first event in a burst is shown as itself, because that is the one worth
 * reading. Anything that follows within the coalesce window is counted and
 * summarised once the window closes, so a flood costs one extra banner instead
 * of a hundred.
 */
export class Notifier {
  private timer: ReturnType<typeof setTimeout> | null = null
  private suppressed = 0
  private reportedFailure = false

  constructor(private readonly options: NotifierOptions) {}

  notify(title: string, body: string): void {
    // Looking at the window already tells you more than a banner would.
    if (!Notification.isSupported() || this.options.isFocused()) {
      return
    }

    // A zero window means every event is worth its own banner.
    if (this.timer) {
      this.suppressed += 1

      return
    }

    this.show(title, body)
    this.openWindow()
  }

  /** Called on quit so a pending summary cannot fire against a dead window. */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    this.suppressed = 0
  }

  private openWindow(): void {
    this.timer = setTimeout(() => {
      this.timer = null

      if (this.suppressed === 0) {
        return
      }

      const count = this.suppressed
      this.suppressed = 0

      this.show('NetOS Debug', `${count} more event${count === 1 ? '' : 's'}`)
      // Another window opens behind the summary, so a burst that outlasts one
      // window still reports at a steady beat rather than all at the end.
      this.openWindow()
    }, this.options.coalesceMs())
  }

  private show(title: string, body: string): void {
    const notification = new Notification({ title, body, silent: !this.options.sound() })

    notification.on('click', () => this.options.onActivate())

    // macOS refuses outright when the app is not authorised — error 1 is
    // UNErrorCodeNotificationsNotAllowed, which is what an unsigned development
    // bundle gets. Silence here makes that look like a bug in the sender, so it
    // is reported once rather than swallowed.
    notification.on('failed', (_event, error) => {
      if (this.reportedFailure) {
        return
      }

      this.reportedFailure = true
      console.error('[notify] macOS rejected the notification:', error)
    })

    notification.show()
  }
}
