import type { Point } from './arrange'
import type { Sticky } from './stickies'

type StickyNoteProps = {
  sticky: Sticky
  /** The canvas zoom, so a screen delta becomes a layer delta. */
  zoom: number
  onMove: (at: Point) => void
  onText: (text: string) => void
  onRemove: () => void
}

export function StickyNote({ sticky, zoom, onMove, onText, onRemove }: StickyNoteProps) {
  return (
    <div className="erd-sticky" style={{ transform: `translate(${sticky.x}px, ${sticky.y}px)` }}>
      <div
        className="erd-sticky__grip"
        onPointerDown={(event) => {
          // Stops the canvas pan: a drag on the grip moves the note.
          event.stopPropagation()

          const start = { x: event.clientX, y: event.clientY }
          const origin = { x: sticky.x, y: sticky.y }
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
      >
        <button
          className="erd-sticky__remove"
          onClick={onRemove}
          onPointerDown={(event) => event.stopPropagation()}
          title="Remove this note"
          type="button"
        >
          ×
        </button>
      </div>
      <textarea
        className="erd-sticky__text"
        onChange={(event) => onText(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="A note on the canvas"
        value={sticky.text}
      />
    </div>
  )
}
