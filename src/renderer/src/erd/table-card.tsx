import type { Point } from './arrange'
import { enumFor } from './enums'
import type { ErdEnum, ErdTable } from './model'

type TableCardProps = {
  table: ErdTable
  at: Point
  selected: boolean
  /** The canvas zoom, so a screen delta becomes a layer delta. */
  zoom: number
  /** Declared enums, so a column typed as one can say what it allows. */
  enums: ErdEnum[]
  onSelect: () => void
  /** Opens the column form; null when editing is not offered. */
  onColumn: ((column: string) => void) | null
  onMove: (point: Point) => void
}

export function TableCard({
  table,
  at,
  selected,
  zoom,
  enums,
  onSelect,
  onMove,
  onColumn,
}: TableCardProps) {
  return (
    <div
      className={selected ? 'erd-card erd-card--selected' : 'erd-card'}
      data-table={table.name}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect()

        const start = { x: event.clientX, y: event.clientY }
        const origin = { ...at }
        // The listeners go on the window rather than the card: a fast drag
        // leaves the card behind, and a listener bound to it stops receiving
        // moves the moment the pointer outruns it.
        // The card sits inside the scaled layer, so the pointer's screen
        // movement has to be divided by the zoom. Without it the card crawls
        // behind the cursor when zoomed out and runs ahead when zoomed in.
        const move = (moved: PointerEvent): void =>
          onMove({
            x: origin.x + (moved.clientX - start.x) / zoom,
            y: origin.y + (moved.clientY - start.y) / zoom,
          })
        const up = (): void => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }

        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
    >
      <div className="erd-card__head">
        <span className="erd-card__name">{table.name}</span>
        {table.note === null ? null : (
          <span className="erd-card__note" title={table.note}>
            note
          </span>
        )}
      </div>
      {table.columns.map((column) => (
        <div
          className={onColumn === null ? 'erd-card__row' : 'erd-card__row erd-card__row--editable'}
          key={column.name}
          onPointerDown={(event) => {
            if (onColumn !== null) {
              // Stops the card's own drag: clicking a row opens it, it does not
              // pick the card up.
              event.stopPropagation()
              onColumn(column.name)
            }
          }}
        >
          <span className="erd-card__col">{column.name}</span>
          {(() => {
            const declared = enumFor(enums, column.type)

            return (
              <span
                className={
                  declared === null ? 'erd-card__type' : 'erd-card__type erd-card__type--enum'
                }
                title={declared === null ? undefined : declared.values.join(', ')}
              >
                {column.type}
              </span>
            )
          })()}
          {column.primary ? <span className="erd-card__mark">pk</span> : null}
          {!column.primary && column.unique ? <span className="erd-card__mark">u</span> : null}
        </div>
      ))}
    </div>
  )
}
