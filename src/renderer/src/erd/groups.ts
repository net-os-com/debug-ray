import type { Layout } from './arrange'
import { CARD_WIDTH, cardHeight, groupColorOf, type ErdModel } from './model'

export type GroupRect = {
  name: string
  color: string
  x: number
  y: number
  width: number
  height: number
}

/** Breathing room so the border and the label clear the cards. */
const PADDING = 20
const LABEL = 24

/**
 * One rectangle per group, around the cards it actually contains.
 *
 * Built from the tables present rather than from the names the group lists: a
 * group may name a table that was deleted from the source, and a rectangle
 * drawn around nothing is worse than no rectangle. A table belongs to at most
 * one group — DBML refuses a second — so the rectangles never nest.
 */
export function groupRects(model: ErdModel, layout: Layout): GroupRect[] {
  const rects: GroupRect[] = []

  model.groups.forEach((group, index) => {
    const boxes = group.tables
      .map((name) => {
        const table = model.tables.find((one) => one.name === name)
        const at = layout[name]

        return table === undefined || at === undefined ? null : { at, height: cardHeight(table) }
      })
      .filter((box): box is { at: { x: number; y: number }; height: number } => box !== null)

    if (boxes.length === 0) {
      return
    }

    const left = Math.min(...boxes.map((box) => box.at.x)) - PADDING
    const top = Math.min(...boxes.map((box) => box.at.y)) - PADDING - LABEL
    const right = Math.max(...boxes.map((box) => box.at.x)) + CARD_WIDTH + PADDING
    const bottom = Math.max(...boxes.map((box) => box.at.y + box.height)) + PADDING

    rects.push({
      name: group.name,
      color: groupColorOf(group, index),
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    })
  })

  return rects
}
