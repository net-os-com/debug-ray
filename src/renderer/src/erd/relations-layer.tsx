import type { Layout } from './arrange'
import { CARD_HEADER_HEIGHT, CARD_WIDTH, COLUMN_ROW_HEIGHT, type ErdRelation } from './model'

/** Where a column sits inside its card, from the card's top. */
export type RowOf = (table: string, column: string) => number

type Geometry = { d: string; mid: { x: number; y: number } }

/**
 * The curve between two columns, or null when either end is not on the canvas.
 *
 * A line leaves the right edge of one card and arrives at the left edge of the
 * other unless that would make it double back, in which case the sides swap —
 * without it, a card to the left of its target is joined by a line that loops
 * around both of them.
 */
export function geometry(relation: ErdRelation, layout: Layout, rowOf: RowOf): Geometry | null {
  const from = layout[relation.from.table]
  const to = layout[relation.to.table]

  if (!from || !to) {
    return null
  }

  const leftToRight = to.x >= from.x
  const x1 = leftToRight ? from.x + CARD_WIDTH : from.x
  const x2 = leftToRight ? to.x : to.x + CARD_WIDTH
  const y1 =
    from.y +
    CARD_HEADER_HEIGHT +
    rowOf(relation.from.table, relation.from.column) +
    COLUMN_ROW_HEIGHT / 2
  const y2 =
    to.y + CARD_HEADER_HEIGHT + rowOf(relation.to.table, relation.to.column) + COLUMN_ROW_HEIGHT / 2
  const bend = (leftToRight ? 1 : -1) * Math.max(40, Math.abs(x2 - x1) / 2)

  return {
    d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
    mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
  }
}

type RelationsLayerProps = {
  relations: ErdRelation[]
  layout: Layout
  rowOf: RowOf
  /** The selected table, whose lines stay solid while the rest fade. */
  selected: string | null
  /** The relation under the pointer, which every other line steps back for. */
  hovered: number | null
  onHover: (index: number | null) => void
}

/**
 * One SVG for every line, sized 1x1 with overflow visible: the paths draw well
 * outside its box, and because the SVG itself takes no pointer events it never
 * swallows a click meant for a card sitting over it.
 *
 * Each line carries a second, invisible copy at a much wider stroke. That is
 * the hit target: a 1.6px curve is almost impossible to put a pointer on, and
 * widening the visible line to catch the pointer would be a drawing decision
 * made for the mouse.
 */
export function RelationsLayer({
  relations,
  layout,
  rowOf,
  selected,
  hovered,
  onHover,
}: RelationsLayerProps) {
  return (
    <svg className="erd-lines" height="1" width="1">
      {relations.map((relation, index) => {
        const shape = geometry(relation, layout, rowOf)

        if (shape === null) {
          return null
        }

        const involved =
          selected === null || selected === relation.from.table || selected === relation.to.table
        // A hover is a direct answer to "where does this one go", so it wins
        // over the selection's own dimming rather than combining with it.
        const faded = hovered === null ? !involved : hovered !== index

        return (
          <g key={`${relation.from.table}.${relation.from.column}-${index}`}>
            <path
              className="erd-line__hit"
              d={shape.d}
              onPointerEnter={() => onHover(index)}
              onPointerLeave={() => onHover(null)}
            />
            <path
              className={relation.crossDatabase ? 'erd-line erd-line--cross' : 'erd-line'}
              d={shape.d}
              opacity={faded ? 0.12 : 1}
              strokeWidth={selected !== null && involved && hovered === null ? 2.2 : 1.6}
            />
            {relation.onDelete === '' || selected === null || !involved || hovered !== null ? null : (
              <text className="erd-line__label" textAnchor="middle" x={shape.mid.x} y={shape.mid.y - 6}>
                {relation.onDelete}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

type RelationHighlightProps = {
  relation: ErdRelation
  layout: Layout
  rowOf: RowOf
}

/**
 * The hovered line, drawn again above the cards.
 *
 * The base layer sits under them, so a line that passes behind a card
 * disappears exactly where you are trying to follow it. Repeating the one line
 * on top is what makes "where does this go" answerable in a dense diagram; it
 * carries its two ends as a label for the same reason.
 */
export function RelationHighlight({ relation, layout, rowOf }: RelationHighlightProps) {
  const shape = geometry(relation, layout, rowOf)

  if (shape === null) {
    return null
  }

  const label = `${relation.from.table}.${relation.from.column} → ${relation.to.table}.${relation.to.column}${
    relation.onDelete === '' ? '' : `  ·  on delete ${relation.onDelete}`
  }`

  return (
    <svg className="erd-lines erd-lines--top" height="1" width="1">
      <path
        className={
          relation.crossDatabase
            ? 'erd-line erd-line--cross erd-line--hot'
            : 'erd-line erd-line--hot'
        }
        d={shape.d}
      />
      <text className="erd-line__caption" textAnchor="middle" x={shape.mid.x} y={shape.mid.y - 10}>
        {label}
      </text>
    </svg>
  )
}
