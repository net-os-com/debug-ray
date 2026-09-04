import { app, nativeImage, type NativeImage } from 'electron'
import { join } from 'node:path'

/**
 * Generated from the design canvas by `npm run icon`. The path holds for both
 * the dev and production builds, since electron-vite emits main to out/main.
 */
const ICON_PNG = join(import.meta.dirname, '../../resources/icon.png')

function load(): NativeImage | null {
  const image = nativeImage.createFromPath(ICON_PNG)

  if (image.isEmpty()) {
    // Silently running without an icon hides a broken path, so say so.
    console.warn(`No app icon at ${ICON_PNG}. Run \`npm run icon\` to generate it.`)

    return null
  }

  return image
}

/** The window icon; macOS ignores it and uses the bundle icon instead. */
export function windowIcon(): NativeImage | undefined {
  return load() ?? undefined
}

/**
 * An unpackaged macOS app shows Electron's own icon in the dock, so set ours
 * explicitly. A packaged build takes it from the bundle and needs no help.
 */
export function applyDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) {
    return
  }

  const image = load()

  if (image) {
    void app.dock.setIcon(image)
  }
}
