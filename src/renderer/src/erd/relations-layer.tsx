import type { Layout } from './arrange'
import { CARD_HEADER_HEIGHT, CARD_WIDTH, type ErdRelation } from './model'

type RelationsLayerProps = {
  relations: ErdRelation[]
  layout: Layout
  /** Vertical offset of a column inside its card, from the card's top. */
  rowOf: (table: string, column: string) => number
}

/**
 * One SVG for every line, sized 1x1 with overflow visible: the paths draw well
 * outside its box, and because it takes no pointer events it never swallows a
 * click meant for a card sitting over it.
 */
export function RelationsLayer({ relations, layout, rowOf }: RelationsLayerProps) {
  return (
    <svg className="erd-lines" height="1" width="1">
      {relations.map((relation, index) => {
        const from = layout[relation.from.table]
        const to = layout[relation.to.table]

        // A relation whose other side is not on the canvas — a cross-database
        // reference, usually — has nowhere to land, so it is not drawn.
        if (!from || !to) {
          return null
        }

        const x1 = from.x + CARD_WIDTH
        const y1 = from.y + CARD_HEADER_HEIGHT + rowOf(relation.from.table, relation.from.column)
        const x2 = to.x
        const y2 = to.y + CARD_HEADER_HEIGHT + rowOf(relation.to.table, relation.to.column)
        const bend = Math.max(40, Math.abs(x2 - x1) / 2)

        return (
          <path
            className={relation.crossDatabase ? 'erd-line erd-line--cross' : 'erd-line'}
            d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
            key={`${relation.from.table}.${relation.from.column}-${index}`}
          />
        )
      })}
    </svg>
  )
}
