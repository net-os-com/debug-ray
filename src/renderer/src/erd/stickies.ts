/**
 * Free notes on the canvas.
 *
 * These are the one thing in the design that cannot live in the DBML: a
 * standalone `Note name { … }` block does not parse in @dbml/core 10.3 —
 * measured, not assumed — and a table's own `Note:` is attached to that table
 * rather than to a spot on the canvas. So they go beside the layout, which is
 * already the file for what the format has no room for.
 *
 * The cost is that they do not travel to dbdiagram.io. The alternative was
 * writing them into the .dbml as comments, which the parser discards, so they
 * could never be read back.
 */
export type Sticky = { id: string; text: string; x: number; y: number }

/** Tolerant on purpose: a layout file written before stickies existed has none. */
export function readStickies(raw: unknown): Sticky[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((one): Sticky[] => {
    if (typeof one !== 'object' || one === null) {
      return []
    }

    const value = one as Partial<Sticky>

    return typeof value.id === 'string' &&
      typeof value.text === 'string' &&
      typeof value.x === 'number' &&
      typeof value.y === 'number'
      ? [{ id: value.id, text: value.text, x: value.x, y: value.y }]
      : []
  })
}
