import type { BrowserWindow } from 'electron'
import type { WindowIntent } from '../shared/window-intent'
import { sendToWindow } from './send-to-window'

/**
 * Hands intents to the main window, whether or not it is ready to hear them.
 *
 * The window an intent is for may have been created a moment ago: "Close to
 * background" is off by default, so a click in the menu bar often has to build
 * the window first. A message sent to a page that has not mounted yet is simply
 * lost, and "finished loading" is not the same moment as "React has
 * subscribed". So the renderer says when it is ready by taking whatever is
 * waiting, and until then the latest intent is kept rather than sent.
 */
export class WindowIntents {
  private pending: WindowIntent | null = null
  private ready = false

  constructor(private readonly target: () => BrowserWindow | null) {}

  deliver(intent: WindowIntent): void {
    if (this.ready && sendToWindow(this.target(), 'ray:intent', intent)) {
      return
    }

    this.pending = intent
  }

  /** Called by the renderer once it listens; from then on intents are sent. */
  take(): WindowIntent | null {
    const intent = this.pending

    this.pending = null
    this.ready = true

    return intent
  }

  /** A new window's renderer has not mounted yet, so it is not listening. */
  reset(): void {
    this.ready = false
  }
}
