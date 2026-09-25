import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import type { Updater } from './updater'

const RELEASES_URL = 'https://github.com/net-os-com/debug-ray/releases'

const IS_MAC = process.platform === 'darwin'

/**
 * Installs the application menu.
 *
 * Electron builds a default menu for you right up until you set one of your
 * own, and then you own every standard item too. The roles below are therefore
 * not decoration: drop them and the window loses copy, paste, zoom, full screen
 * and the developer tools along with them.
 */
export function applyMenu(updater: Updater): void {
  const checkForUpdates: MenuItemConstructorOptions = {
    label: 'Check for Updates…',
    click: () => updater.check({ asked: true }),
  }

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      checkForUpdates,
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }

  const template: MenuItemConstructorOptions[] = [
    ...(IS_MAC ? [appMenu] : []),
    {
      label: 'File',
      submenu: [IS_MAC ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        // Tinker runs a snippet with Cmd+R, and a menu accelerator wins over
        // the page, so reloading moves aside rather than reloading the app
        // mid-edit.
        { role: 'reload', accelerator: 'CmdOrCtrl+Alt+R' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: IS_MAC
        ? [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
          ]
        : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
    {
      role: 'help',
      submenu: [
        // Somewhere to go when the in-app update cannot be applied, which is
        // every unsigned or sideloaded build.
        {
          label: 'Releases on GitHub',
          click: () => void shell.openExternal(RELEASES_URL),
        },
        // On Windows and Linux there is no application menu to hang it under.
        ...(IS_MAC ? [] : [{ type: 'separator' } as const, checkForUpdates]),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
