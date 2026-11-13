import type { MenuItemConstructorOptions } from 'electron'
import type { UpdateStatus } from '../../shared/ray-event'

/** What the menu reflects; read fresh on every right-click. */
export type TrayMenuState = {
  paused: boolean
  update: UpdateStatus
}

export type TrayMenuActions = {
  open: () => void
  settings: () => void
  togglePause: () => void
  clearStream: () => void
  downloadUpdate: () => void
  installUpdate: () => void
  quit: () => void
}

/**
 * The menu a right click on the menu bar icon opens.
 *
 * "Quit" rather than "Close": closing is what the window already does, and with
 * "Close to background" on it only hides it. This is the one place that stops
 * the receiver as well.
 *
 * Pause and Clear are here because they are what you otherwise bring the
 * window forward for when a stream floods. The update only shows while there
 * is one; nothing downloads unasked, so the menu offers each step in turn.
 */
export function trayMenuTemplate(
  state: TrayMenuState,
  actions: TrayMenuActions,
): MenuItemConstructorOptions[] {
  const update = updateItem(state.update, actions)

  return [
    { label: 'Open NetOS Debug', click: actions.open },
    { label: 'Settings…', click: actions.settings },
    { type: 'separator' },
    { label: state.paused ? 'Resume Stream' : 'Pause Stream', click: actions.togglePause },
    { label: 'Clear Stream', click: actions.clearStream },
    { type: 'separator' },
    ...(update ? [update, { type: 'separator' } as const] : []),
    { label: 'Quit NetOS Debug', click: actions.quit },
  ]
}

function updateItem(
  update: UpdateStatus,
  actions: TrayMenuActions,
): MenuItemConstructorOptions | null {
  switch (update.phase) {
    case 'available':
      return { label: `Download NetOS Debug ${update.version}…`, click: actions.downloadUpdate }
    case 'downloading':
      return { label: `Downloading ${update.version}… ${update.percent}%`, enabled: false }
    case 'ready':
      return { label: `Restart to Install ${update.version}`, click: actions.installUpdate }
    default:
      // Checking, up to date or failed: nothing to act on from here. The
      // window's banner says what went wrong.
      return null
  }
}
