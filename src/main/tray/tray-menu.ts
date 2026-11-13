import { Menu } from 'electron'

export type TrayMenuActions = {
  open: () => void
  settings: () => void
  quit: () => void
}

/**
 * The menu a right click on the menu bar icon opens.
 *
 * "Quit" rather than "Close": closing is what the window already does, and with
 * "Close to background" on it only hides it. This is the one place that stops
 * the receiver as well.
 */
export function buildTrayMenu(actions: TrayMenuActions): Menu {
  return Menu.buildFromTemplate([
    { label: 'Open NetOS Debug', click: actions.open },
    { label: 'Settings…', click: actions.settings },
    { type: 'separator' },
    { label: 'Quit NetOS Debug', click: actions.quit },
  ])
}
