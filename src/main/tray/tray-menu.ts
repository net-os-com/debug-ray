import { Menu } from 'electron'
import { trayMenuTemplate, type TrayMenuActions, type TrayMenuState } from './tray-menu-template'

/**
 * The right-click menu, built for the state it is opened in. The template is
 * kept apart so it can be checked without Electron.
 */
export function buildTrayMenu(state: TrayMenuState, actions: TrayMenuActions): Menu {
  return Menu.buildFromTemplate(trayMenuTemplate(state, actions))
}
