import type { UnseenState } from './unseen-count'

/** Beyond this the exact number stops mattering; it only has to say "a lot". */
const MAX_SHOWN = 99

/** Electron draws ANSI colours in a tray title; red for an exception. */
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

/**
 * The text beside the menu bar icon: nothing when there is nothing new, so the
 * icon sits alone, and the count otherwise.
 *
 * Red text rather than a red dot in the image, because the image is a template
 * that macOS tints for light, dark and wallpaper-tinted menu bars, and a
 * coloured image would follow none of them.
 */
export function trayTitle(state: UnseenState): string {
  if (state.count === 0) {
    return ''
  }

  const text = state.count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(state.count)

  return state.error ? `${RED}${text}${RESET}` : text
}
