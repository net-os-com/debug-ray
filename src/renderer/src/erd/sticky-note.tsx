import type { Point } from './arrange'
import type { Sticky } from './stickies'
import { useDrag } from './use-drag'

type StickyNoteProps = {
  sticky: Sticky
  zoom: number
  onMove: (at: Point) => void
}

/**
 * A standalone `Note` block, on the canvas.
 *
 * It shows its text rather than offering a box to type in: the note lives in
 * the DBML, so the editor on the left is where it is written, and two places
 * to edit the same text would have to agree about which one won.
 */
export function StickyNote({ sticky, zoom, onMove }: StickyNoteProps) {
  const drag = useDrag({ x: sticky.x, y: sticky.y }, zoom, onMove)

  return (
    <div
      className="erd-sticky"
      onPointerDown={(event) => {
        event.stopPropagation()
        drag(event)
      }}
      style={{ transform: `translate(${sticky.x}px, ${sticky.y}px)` }}
    >
      <div className="erd-sticky__name">{sticky.name}</div>
      <div className="erd-sticky__text">{sticky.text}</div>
    </div>
  )
}
