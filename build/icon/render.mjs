import { app, BrowserWindow } from 'electron'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HERE = import.meta.dirname
const ROOT = join(HERE, '..', '..')
const OUT = join(ROOT, 'resources')
const WORK = join(ROOT, 'build', 'icon', '.work')
const ICONSET = join(WORK, 'icon.iconset')
const TRAY_OUT = join(OUT, 'tray')

/**
 * The menu bar icon at rest (100) and the fainter steps its pulse plays
 * through. src/main/tray/tray-images.ts loads these names, so they move together.
 */
const TRAY_OPACITIES = [100, 75, 50, 30]

/**
 * Which mark variant each raster size uses. The design keeps the gradient bars
 * for large renders and swaps to flat 55% fills below 256px so the mark still
 * reads at 32px.
 */
const SIZES = [
  { name: 'icon_16x16', px: 16, variant: 'flat' },
  { name: 'icon_16x16@2x', px: 32, variant: 'flat' },
  { name: 'icon_32x32', px: 32, variant: 'flat' },
  { name: 'icon_32x32@2x', px: 64, variant: 'flat' },
  { name: 'icon_128x128', px: 128, variant: 'flat' },
  { name: 'icon_128x128@2x', px: 256, variant: 'gradient' },
  { name: 'icon_256x256', px: 256, variant: 'gradient' },
  { name: 'icon_256x256@2x', px: 512, variant: 'gradient' },
  { name: 'icon_512x512', px: 512, variant: 'gradient' },
  { name: 'icon_512x512@2x', px: 1024, variant: 'gradient' },
]

/**
 * The one offscreen window every capture is taken from. The app icon and the
 * menu bar icon share it, the second page loaded into the first one's window:
 * a second window means a second renderer process, which is one more thing to
 * fail for no gain.
 */
function captureWindow() {
  return new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, backgroundThrottling: false },
  })
}

/**
 * One page, loaded once, captured twice: the variant is a body attribute, so
 * flipping it is cheaper and more reliable than a second file load.
 */
async function renderMasters(window) {
  await window.loadFile(join(HERE, 'icon.html'))

  const masters = {}

  for (const variant of ['gradient', 'flat']) {
    await window.webContents.executeJavaScript(
      `document.body.dataset.variant = ${JSON.stringify(variant)}; true`,
    )

    // Give the compositor a frame to draw the gradients and shadows.
    await new Promise((resolve) => setTimeout(resolve, 400))

    const image = await window.webContents.capturePage()
    const size = image.getSize()

    if (size.width === 0 || size.height === 0) {
      throw new Error(`capturePage returned an empty image for the ${variant} variant`)
    }

    const file = join(WORK, `master-${variant}.png`)

    writeFileSync(file, image.toPNG())

    // A retina display captures at 2x; normalise to the 1024 master.
    execFileSync('sips', ['-z', '1024', '1024', file], { stdio: 'ignore' })

    console.log(`master ${variant}: captured ${size.width}x${size.height} -> 1024x1024`)

    masters[variant] = file
  }

  return masters
}

/**
 * Captures tray.html once per opacity and writes each at 16pt, at 1x and 2x.
 *
 * The names end in `Template`, which macOS reads as "tint me for the menu
 * bar", and the 2x file sits beside the 1x one as `@2x`, which is how
 * Electron's nativeImage finds it.
 */
async function renderTray(window) {
  await window.loadFile(join(HERE, 'tray.html'))
  mkdirSync(TRAY_OUT, { recursive: true })

  for (const opacity of TRAY_OPACITIES) {
    await window.webContents.executeJavaScript(
      `document.body.dataset.opacity = ${JSON.stringify(String(opacity))}; true`,
    )

    await new Promise((resolve) => setTimeout(resolve, 300))

    const image = await window.webContents.capturePage()
    const master = join(WORK, `tray-${opacity}.png`)

    writeFileSync(master, image.toPNG())

    const name = opacity === 100 ? 'trayTemplate' : `tray-${opacity}Template`

    for (const [suffix, px] of [['', 16], ['@2x', 32]]) {
      const target = join(TRAY_OUT, `${name}${suffix}.png`)

      execFileSync('cp', [master, target])
      execFileSync('sips', ['-z', String(px), String(px), target], { stdio: 'ignore' })
    }
  }

  console.log(`wrote ${TRAY_OPACITIES.length * 2} menu bar images to ${TRAY_OUT}`)
}

app.whenReady().then(async () => {
  try {
    rmSync(WORK, { recursive: true, force: true })
    mkdirSync(ICONSET, { recursive: true })
    mkdirSync(OUT, { recursive: true })

    const window = captureWindow()
    const masters = await renderMasters(window)

    for (const size of SIZES) {
      const target = join(ICONSET, `${size.name}.png`)

      execFileSync('cp', [masters[size.variant], target])
      execFileSync('sips', ['-z', String(size.px), String(size.px), target], { stdio: 'ignore' })
    }

    execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', join(OUT, 'icon.icns')])
    execFileSync('cp', [masters.gradient, join(OUT, 'icon.png')])
    execFileSync('sips', ['-z', '512', '512', join(OUT, 'icon.png')], { stdio: 'ignore' })

    console.log(`wrote ${join(OUT, 'icon.icns')} and ${join(OUT, 'icon.png')}`)

    await renderTray(window)
    window.destroy()

    rmSync(WORK, { recursive: true, force: true })
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
