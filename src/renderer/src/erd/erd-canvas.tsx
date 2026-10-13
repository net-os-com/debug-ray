import type { Layout, Point } from './arrange'
import { groupRects } from './groups'
import { CARD_WIDTH, cardHeight, COLUMN_ROW_HEIGHT, type ErdModel } from './model'
import { RelationsLayer } from './relations-layer'
import { TableCard } from './table-card'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2

export type View = { x: number; y: number; z: number }

/**
 * The transform that brings every placed card into view with a margin.
 *
 * Clamped to the same limits as the wheel, so a schema of three tables does not
 * zoom to something unreadable and one of three hundred still lands on screen.
 */
export function fitView(model: ErdModel, layout: Layout, width: number, height: number): View {
  const boxes = model.tables
    .map((table) => ({ at: layout[table.name], height: cardHeight(table) }))
    .filter((box): box is { at: Point; height: number } => box.at !== undefined)

  if (boxes.length === 0 || width === 0 || height === 0) {
    return { x: 0, y: 0, z: 1 }
  }

  const left = Math.min(...boxes.map((box) => box.at.x))
  const top = Math.min(...boxes.map((box) => box.at.y))
  const right = Math.max(...boxes.map((box) => box.at.x)) + CARD_WIDTH
  // Measured per card: a twenty-four column table is far taller than a three
  // column one, and a fixed height clipped it.
  const bottom = Math.max(...boxes.map((box) => box.at.y + box.height))
  const z = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, Math.min(width / (right - left), height / (bottom - top)) * 0.9),
  )

  return {
    x: (width - (right - left) * z) / 2 - left * z,
    y: (height - (bottom - top) * z) / 2 - top * z,
    z,
  }
}

type ErdCanvasProps = {
  model: ErdModel
  layout: Layout
  view: View
  selected: string | null
  onView: (view: View) => void
  onSelect: (table: string | null) => void
  onMove: (table: string, at: Point) => void
  onColumn: ((table: string, column: string) => void) | null
}

export function ErdCanvas({
  model,
  layout,
  view,
  selected,
  onView,
  onSelect,
  onMove,
  onColumn,
}: ErdCanvasProps) {
  const rowOf = (table: string, column: string): number => {
    const found = model.tables.find((one) => one.name === table)
    const index = found?.columns.findIndex((one) => one.name === column) ?? -1

    return (index < 0 ? 0 : index) * COLUMN_ROW_HEIGHT
  }

  return (
    <div
      className="erd-canvas"
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }

        onSelect(null)

        const start = { x: event.clientX, y: event.clientY }
        const origin = { x: view.x, y: view.y }
        const move = (moved: PointerEvent): void =>
          onView({
            ...view,
            x: origin.x + (moved.clientX - start.x),
            y: origin.y + (moved.clientY - start.y),
          })
        const up = (): void => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }

        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      onWheel={(event) => {
        // Zoom is applied around the layer's origin rather than the cursor.
        // That is what Fit exists for; anchoring to the pointer is a
        // refinement, not a requirement of this pass.
        const next = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, view.z * (event.deltaY < 0 ? 1.1 : 1 / 1.1)),
        )

        onView({ ...view, z: next })
      }}
    >
      <div
        className="erd-layer"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
      >
        {groupRects(model, layout).map((rect) => (
          <div
            className="erd-group"
            key={rect.name}
            style={{
              transform: `translate(${rect.x}px, ${rect.y}px)`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          >
            <span className="erd-group__name">{rect.name}</span>
          </div>
        ))}
        <RelationsLayer layout={layout} relations={model.relations} rowOf={rowOf} />
        {model.tables.map((table) => {
          const at = layout[table.name]

          return at ? (
            <TableCard
              at={at}
              enums={model.enums}
              key={table.name}
              onColumn={onColumn === null ? null : (column) => onColumn(table.name, column)}
              onMove={(point) => onMove(table.name, point)}
              onSelect={() => onSelect(table.name)}
              selected={selected === table.name}
              table={table}
              zoom={view.z}
            />
          ) : null
        })}
      </div>
    </div>
  )
}
