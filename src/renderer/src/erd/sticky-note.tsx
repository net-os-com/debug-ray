import { useEffect, useRef, useState } from 'react'
import type { Point } from './arrange'
import type { Sticky } from './stickies'
import { useDrag } from './use-drag'

type StickyNoteProps = {
  sticky: Sticky
  zoom: number
  onMove: (at: Point) => void
  /** Writes the note's text back into the DBML. */
  onEdit: (text: string) => void
}

/**
 * A standalone `Note` block, written on the canvas.
 *
 * The text is a real textarea rather than a rendering of the source. There is
 * still one copy of it — every keystroke is patched straight into the DBML, so
 * the editor on the left and the note on the canvas are two views of the same
 * string and neither can win an argument with the other.
 *
 * Dragging moves to the title bar because the body now takes the pointer: a
 * click in a textarea has to place a caret, and a note you cannot click into
 * is the thing this is fixing.
 */
export function StickyNote({ sticky, zoom, onMove, onEdit }: StickyNoteProps) {
  const drag = useDrag({ x: sticky.x, y: sticky.y }, zoom, onMove)
  const area = useRef<HTMLTextAreaElement>(null)
  /**
   * What is being typed, kept here while the field has focus.
   *
   * Without it the caret jumps: the source is reparsed on every keystroke, and
   * the text coming back is a round trip through the escaper, which arrives a
   * render later and resets the selection. The patch still goes out on every
   * keystroke — this only decides which string the field shows meanwhile.
   */
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? sticky.text

  // Grows to fit, so a note is as tall as what it holds.
  useEffect(() => {
    const element = area.current

    if (element !== null) {
      element.style.height = 'auto'
      element.style.height = `${element.scrollHeight}px`
    }
  }, [text])

  return (
    <div className="erd-sticky" style={{ transform: `translate(${sticky.x}px, ${sticky.y}px)` }}>
      <div
        className="erd-sticky__name"
        onPointerDown={(event) => {
          event.stopPropagation()
          drag(event)
        }}
        title="Drag to move"
      >
        {sticky.name}
      </div>

      <textarea
        className="erd-sticky__text"
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          setDraft(event.target.value)
          onEdit(event.target.value)
        }}
        onFocus={() => setDraft(sticky.text)}
        // The canvas pans on pointer-down and selects on click; inside the
        // note both belong to the text.
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="Write the note here."
        ref={area}
        rows={1}
        spellCheck={false}
        value={text}
      />
    </div>
  )
}
