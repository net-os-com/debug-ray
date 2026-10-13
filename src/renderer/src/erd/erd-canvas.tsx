import type { Layout, Point } from './arrange'
import { groupRects } from './groups'
import { GripIcon } from './icons'
import { CARD_WIDTH, cardHeight, COLUMN_ROW_HEIGHT, type ErdModel, type ErdTable } from './model'
import { RelationsLayer } from './relations-layer'
import type { Sticky } from './stickies'
import { StickyNote } from './sticky-note'
import { TableCard } from './table-card'

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2

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
  /** Which tables the search and the scope filter match; the rest are dimmed. */
  matches: (table: ErdTable) => boolean
  onView: (view: View) => void
  onSelect: (table: string | null) => void
  onMove: (table: string, at: Point) => void
  onColumn: (table: string, column: string) => void
  stickies: Sticky[]
  onStickyMove: (name: string, at: Point) => void
  onGroupMove: (group: string, delta: Point) => void
}

export function ErdCanvas({
  model,
  layout,
  view,
  selected,
  matches,
  onView,
  onSelect,
  onMove,
  onColumn,
  stickies,
  onStickyMove,
  onGroupMove,
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
        // Anchored on the pointer: zooming toward the middle of the viewport
        // walks the table you are looking at off the edge on a wide schema.
        const box = event.currentTarget.getBoundingClientRect()
        const px = event.clientX - box.left
        const py = event.clientY - box.top
        const next = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, view.z * (event.deltaY < 0 ? 1.1 : 1 / 1.1)),
        )
        const ratio = next / view.z

        onView({
          x: px - (px - view.x) * ratio,
          y: py - (py - view.y) * ratio,
          z: next,
        })
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
            onPointerDown={(event) => {
              event.stopPropagation()

              const start = { x: event.clientX, y: event.clientY }
              let last = { x: 0, y: 0 }
              const move = (moved: PointerEvent): void => {
                const now = {
                  x: (moved.clientX - start.x) / view.z,
                  y: (moved.clientY - start.y) / view.z,
                }

                onGroupMove(rect.name, { x: now.x - last.x, y: now.y - last.y })
                last = now
              }
              const up = (): void => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', up)
              }

              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', up)
            }}
            style={{
              transform: `translate(${rect.x}px, ${rect.y}px)`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              background: `${rect.color}14`,
              borderColor: `${rect.color}55`,
            }}
            title="Drag to move group"
          >
            <span className="erd-group__name" style={{ color: rect.color }}>
              <GripIcon />
              {rect.name}
            </span>
          </div>
        ))}

        <RelationsLayer
          layout={layout}
          relations={model.relations}
          rowOf={rowOf}
          selected={selected}
        />

        {stickies.map((sticky) => (
          <StickyNote
            key={sticky.name}
            onMove={(at) => onStickyMove(sticky.name, at)}
            sticky={sticky}
            zoom={view.z}
          />
        ))}

        {model.tables.map((table) => {
          const at = layout[table.name]

          return at ? (
            <TableCard
              at={at}
              dimmed={!matches(table)}
              enums={model.enums}
              key={table.name}
              onColumn={(column) => onColumn(table.name, column)}
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
