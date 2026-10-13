import type { Point } from './arrange'
import { enumFor } from './enums'
import { headerColorOf, type ErdColumn, type ErdEnum, type ErdTable } from './model'
import { KeyIcon, LinkIcon, NoteIcon } from './icons'
import { useDrag } from './use-drag'

type TableCardProps = {
  table: ErdTable
  at: Point
  selected: boolean
  /** Dimmed when a search is on and this table is not a match. */
  dimmed: boolean
  /** The canvas zoom, so a screen delta becomes a layer delta. */
  zoom: number
  /** Declared enums, so a column typed as one can say what it allows. */
  enums: ErdEnum[]
  onSelect: () => void
  /** Opens the column form in the inspector. */
  onColumn: (column: string) => void
  onMove: (point: Point) => void
}

export function TableCard({
  table,
  at,
  selected,
  dimmed,
  zoom,
  enums,
  onSelect,
  onMove,
  onColumn,
}: TableCardProps) {
  const drag = useDrag(at, zoom, onMove)

  return (
    <div
      className={selected ? 'erd-card erd-card--selected' : 'erd-card'}
      data-table={table.name}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect()
        drag(event)
      }}
      style={{ transform: `translate(${at.x}px, ${at.y}px)`, opacity: dimmed ? 0.35 : 1 }}
    >
      <div className="erd-card__head" style={{ background: headerColorOf(table) }}>
        <span className="erd-card__name">{table.label}</span>
        {table.note === null ? null : (
          <span className="erd-card__note" title={table.note}>
            <NoteIcon />
          </span>
        )}
        <span className="erd-card__scope">{table.scope}</span>
      </div>
      {table.columns.map((column) => (
        <div
          className="erd-card__row"
          key={column.name}
          onDoubleClick={(event) => {
            event.stopPropagation()
            onColumn(column.name)
          }}
          title={tooltip(column, enums)}
        >
          <span className="erd-card__icon">
            {column.primary ? <KeyIcon /> : column.references !== null ? <LinkIcon /> : null}
          </span>
          <span
            className="erd-card__col"
            style={{ fontWeight: column.primary ? 600 : 400 }}
          >
            {column.name}
          </span>
          {column.note === null ? null : <span className="erd-card__dot" />}
          <span
            className={
              enumFor(enums, column.type) === null
                ? 'erd-card__type'
                : 'erd-card__type erd-card__type--enum'
            }
          >
            {column.type}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Everything about a column that does not fit on its row. */
function tooltip(column: ErdColumn, enums: ErdEnum[]): string {
  const parts = [`${column.name} ${column.type}`]
  const declared = enumFor(enums, column.type)

  if (declared !== null) {
    parts.push(declared.values.join(', '))
  }

  if (column.primary) {
    parts.push('primary key')
  }

  if (column.unique) {
    parts.push('unique')
  }

  if (!column.nullable) {
    parts.push('not null')
  }

  if (column.defaultValue !== null) {
    parts.push(`default ${column.defaultValue}`)
  }

  if (column.references !== null) {
    parts.push(`→ ${column.references.table}.${column.references.column}`)
  }

  if (column.note !== null) {
    parts.push(column.note)
  }

  return parts.join(' · ')
}
