import type { BrowserWindow } from 'electron'

/**
 * Sends to the window, or does nothing because there is no longer a window.
 *
 * `window?.webContents.send(...)` looks like it covers this and does not: the
 * optional chain guards a null reference, while what actually happens on quit is
 * that the reference survives and the object behind it is destroyed. Anything
 * still delivering at that moment — a socket frame, a ray payload, the tail of a
 * command's output — then throws `Object has been destroyed` from the main
 * process, which Electron reports as an uncaught exception on the way out.
 *
 * So every send in the main process goes through here, rather than each caller
 * remembering to ask twice.
 */
export function sendToWindow(
  window: BrowserWindow | null,
  channel: string,
  ...args: unknown[]
): boolean {
  if (window === null || window.isDestroyed() || window.webContents.isDestroyed()) {
    return false
  }

  window.webContents.send(channel, ...args)

  return true
}
