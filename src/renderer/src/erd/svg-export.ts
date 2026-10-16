import type { Layout } from './arrange'
import {
  CARD_HEADER_HEIGHT,
  CARD_WIDTH,
  COLUMN_ROW_HEIGHT,
  cardHeight,
  headerColorOf,
  type ErdModel,
} from './model'
import { geometry } from './relations-layer'

const PADDING = 48
const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/**
 * Draws the diagram as a standalone SVG.
 *
 * Built from the model rather than scraped from the window on purpose. What is
 * on screen is HTML cards styled with CSS custom properties, and those resolve
 * to nothing once the markup leaves the application — a scrape would export a
 * diagram that is correct in shape and blank in colour. Reading the model
 * instead means the file opens the same everywhere, and it carries no theme:
 * the export is light, because it is going into a document.
 */
export function toSvg(model: ErdModel, layout: Layout): string {
  const placed = model.tables.filter((table) => layout[table.name] !== undefined)

  if (placed.length === 0) {
    return ''
  }

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const table of placed) {
    const at = layout[table.name] as { x: number; y: number }

    left = Math.min(left, at.x)
    top = Math.min(top, at.y)
    right = Math.max(right, at.x + CARD_WIDTH)
    bottom = Math.max(bottom, at.y + cardHeight(table))
  }

  const width = right - left + PADDING * 2
  const height = bottom - top + PADDING * 2
  const shift = (x: number, y: number): [number, number] => [x - left + PADDING, y - top + PADDING]

  const rowOf = (table: string, column: string): number => {
    const found = model.tables.find((one) => one.name === table)
    const index = found?.columns.findIndex((one) => one.name === column) ?? -1

    return (index < 0 ? 0 : index) * COLUMN_ROW_HEIGHT
  }

  const parts: string[] = []

  // Relations first so the cards sit on top of them, as on the canvas.
  for (const relation of model.relations) {
    const line = geometry(relation, layout, rowOf)

    if (line === null) {
      continue
    }

    parts.push(
      `<path d="${moved(line.d, left - PADDING, top - PADDING)}" fill="none" stroke="#9ca3af" stroke-width="1.5"/>`,
    )
  }

  for (const table of placed) {
    const at = layout[table.name] as { x: number; y: number }
    const [x, y] = shift(at.x, at.y)
    const tall = cardHeight(table)
    const header = headerColorOf(table)

    parts.push(
      `<g>`,
      `<rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${tall}" rx="10" fill="#ffffff" stroke="#d9d9d9"/>`,
      `<path d="M ${x} ${y + 10} a 10 10 0 0 1 10 -10 h ${CARD_WIDTH - 20} a 10 10 0 0 1 10 10 v ${CARD_HEADER_HEIGHT - 10} h -${CARD_WIDTH} Z" fill="${header}"/>`,
      `<text x="${x + 12}" y="${y + 24}" fill="#ffffff" font-family="${FONT}" font-size="12.5" font-weight="600">${escape(table.label)}</text>`,
    )

    table.columns.forEach((column, index) => {
      const lineY = y + CARD_HEADER_HEIGHT + index * COLUMN_ROW_HEIGHT

      if (index > 0) {
        parts.push(
          `<line x1="${x}" y1="${lineY}" x2="${x + CARD_WIDTH}" y2="${lineY}" stroke="#f0f0f0"/>`,
        )
      }

      const name = `${column.name}${column.primary ? '  PK' : ''}`

      parts.push(
        `<text x="${x + 12}" y="${lineY + 18}" fill="#0d0d0d" font-family="${FONT}" font-size="11.5">${escape(name)}</text>`,
        `<text x="${x + CARD_WIDTH - 12}" y="${lineY + 18}" fill="#8c8c8c" font-family="${FONT}" font-size="11" text-anchor="end">${escape(column.type)}</text>`,
      )
    })

    parts.push(`</g>`)
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#fafafa"/>`,
    ...parts,
    `</svg>`,
  ].join('\n')
}

/**
 * Shifts a path into the exported viewBox.
 *
 * `geometry` works in canvas coordinates, which start wherever the tables
 * happen to be. Rewriting the numbers is cheaper than teaching it a second
 * coordinate system that only this file would use.
 */
function moved(d: string, dx: number, dy: number): string {
  let axis = 0

  return d.replace(/-?\d+(\.\d+)?/g, (match) => {
    const value = Number(match) - (axis % 2 === 0 ? dx : dy)

    axis += 1

    return String(Math.round(value * 100) / 100)
  })
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
