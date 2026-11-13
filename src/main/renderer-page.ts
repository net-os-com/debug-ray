import type { BrowserWindow } from 'electron'
import { join } from 'node:path'

/** The renderer's HTML entries: the main window, and the menu bar panel. */
export type RendererPage = 'index' | 'tray'

/**
 * Loads one of the renderer's pages into a window.
 *
 * In development electron-vite serves the renderer and says where; packaged,
 * the pages sit next to main in out/. Both windows load the same way, so the
 * choice between the two lives here once.
 */
export function loadRendererPage(window: BrowserWindow, page: RendererPage): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL

  if (devUrl) {
    void window.loadURL(`${devUrl}/${page}.html`)

    return
  }

  void window.loadFile(join(import.meta.dirname, `../renderer/${page}.html`))
}
