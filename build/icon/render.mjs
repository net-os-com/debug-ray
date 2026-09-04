import { app, BrowserWindow } from 'electron'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HERE = import.meta.dirname
const ROOT = join(HERE, '..', '..')
const OUT = join(ROOT, 'resources')
const WORK = join(ROOT, 'build', 'icon', '.work')
const ICONSET = join(WORK, 'icon.iconset')

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
 * One window, loaded once, captured twice: the variant is a body attribute, so
 * flipping it is cheaper and more reliable than a second file load.
 */
async function renderMasters() {
  const window = new BrowserWindow({
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

  window.destroy()

  return masters
}

app.whenReady().then(async () => {
  try {
    rmSync(WORK, { recursive: true, force: true })
    mkdirSync(ICONSET, { recursive: true })
    mkdirSync(OUT, { recursive: true })

    const masters = await renderMasters()

    for (const size of SIZES) {
      const target = join(ICONSET, `${size.name}.png`)

      execFileSync('cp', [masters[size.variant], target])
      execFileSync('sips', ['-z', String(size.px), String(size.px), target], { stdio: 'ignore' })
    }

    execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', join(OUT, 'icon.icns')])
    execFileSync('cp', [masters.gradient, join(OUT, 'icon.png')])
    execFileSync('sips', ['-z', '512', '512', join(OUT, 'icon.png')], { stdio: 'ignore' })

    console.log(`wrote ${join(OUT, 'icon.icns')} and ${join(OUT, 'icon.png')}`)

    rmSync(WORK, { recursive: true, force: true })
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
