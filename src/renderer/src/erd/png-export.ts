/** Twice the pixels, so the file still reads when it is dropped into a doc. */
const SCALE = 2

/**
 * Rasterises an SVG string to PNG, as base64 without the data-URL prefix.
 *
 * Drawn through an Image rather than by re-implementing the diagram on a
 * canvas: the SVG is already the drawing, and this way the two exports can
 * never drift apart. The SVG is handed over as a data URL because a blob URL
 * has an origin and this window's origin is `file://`, which taints the canvas
 * and makes `toDataURL` throw.
 */
export function toPng(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const size = /width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/.exec(svg)

    if (size === null) {
      reject(new Error('The diagram has no size to render.'))

      return
    }

    const width = Number(size[1])
    const height = Number(size[2])
    const image = new Image()

    image.onload = () => {
      const canvas = document.createElement('canvas')

      canvas.width = Math.round(width * SCALE)
      canvas.height = Math.round(height * SCALE)

      const context = canvas.getContext('2d')

      if (context === null) {
        reject(new Error('This window has no 2D canvas.'))

        return
      }

      context.scale(SCALE, SCALE)
      context.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''))
    }

    image.onerror = () => reject(new Error('The diagram could not be rendered.'))
    // encodeURIComponent rather than btoa: the schema may hold characters
    // outside Latin-1, and btoa throws on those.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
