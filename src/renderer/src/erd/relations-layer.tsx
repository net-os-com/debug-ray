import type { Layout } from './arrange'
import { CARD_HEADER_HEIGHT, CARD_WIDTH, COLUMN_ROW_HEIGHT, type ErdRelation } from './model'

type RelationsLayerProps = {
  relations: ErdRelation[]
  layout: Layout
  /** Vertical offset of a column inside its card, from the card's top. */
  rowOf: (table: string, column: string) => number
  /** The selected table, whose lines are drawn solid while the rest fade. */
  selected: string | null
}

/**
 * One SVG for every line, sized 1x1 with overflow visible: the paths draw well
 * outside its box, and because it takes no pointer events it never swallows a
 * click meant for a card sitting over it.
 *
 * A line leaves the right edge of one card and arrives at the left edge of the
 * other unless that would make it double back, in which case the sides swap —
 * without it, a card to the left of its target is joined by a line that loops
 * around both of them.
 */
export function RelationsLayer({ relations, layout, rowOf, selected }: RelationsLayerProps) {
  return (
    <svg className="erd-lines" height="1" width="1">
      {relations.map((relation, index) => {
        const from = layout[relation.from.table]
        const to = layout[relation.to.table]

        if (!from || !to) {
          return null
        }

        const leftToRight = to.x >= from.x
        const x1 = leftToRight ? from.x + CARD_WIDTH : from.x
        const x2 = leftToRight ? to.x : to.x + CARD_WIDTH
        const y1 =
          from.y + CARD_HEADER_HEIGHT + rowOf(relation.from.table, relation.from.column) + COLUMN_ROW_HEIGHT / 2
        const y2 =
          to.y + CARD_HEADER_HEIGHT + rowOf(relation.to.table, relation.to.column) + COLUMN_ROW_HEIGHT / 2
        const bend = (leftToRight ? 1 : -1) * Math.max(40, Math.abs(x2 - x1) / 2)
        const involved =
          selected === null ||
          selected === relation.from.table ||
          selected === relation.to.table
        const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }

        return (
          <g key={`${relation.from.table}.${relation.from.column}-${index}`}>
            <path
              className={relation.crossDatabase ? 'erd-line erd-line--cross' : 'erd-line'}
              d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
              opacity={involved ? 1 : 0.25}
              strokeWidth={selected !== null && involved ? 2.2 : 1.6}
            />
            {relation.onDelete === '' || !involved || selected === null ? null : (
              <text
                className="erd-line__label"
                textAnchor="middle"
                x={mid.x}
                y={mid.y - 6}
              >
                {relation.onDelete}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
