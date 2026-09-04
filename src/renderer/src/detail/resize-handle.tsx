import { useRef, type PointerEvent } from 'react'

type ResizeHandleProps = {
  width: number
  /** Called with the requested width and the width of the row to clamp against. */
  onResize: (width: number, containerWidth: number) => void
  onReset: () => void
}

/**
 * Sits on the panel's left edge. Pointer capture keeps the drag alive even when
 * the cursor leaves the window, which a window-level mousemove listener does
 * not reliably do.
 */
export function ResizeHandle({ width, onResize, onReset }: ResizeHandleProps) {
  const start = useRef({ x: 0, width: 0, container: 0 })

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    const row = event.currentTarget.closest('.app__stream')

    start.current = {
      x: event.clientX,
      width,
      container: row?.clientWidth ?? window.innerWidth,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add('is-resizing')
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }

    // The panel is on the right, so dragging left makes it wider.
    onResize(start.current.width + (start.current.x - event.clientX), start.current.container)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.classList.remove('is-resizing')
  }

  return (
    <div
      className="resize-handle"
      onDoubleClick={onReset}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      title="Drag to resize · double-click to reset"
    />
  )
}
