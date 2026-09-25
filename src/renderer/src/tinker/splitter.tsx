import { useCallback, useState, type MouseEvent } from 'react'

type SplitterProps = {
  /** Given the pointer's x, decides what the new layout is. */
  onDrag: (clientX: number) => void
  onReset: () => void
}

/**
 * The drag handle between two panes.
 *
 * It listens on the window rather than on itself: the pointer routinely leaves
 * a seven-pixel strip mid-drag, and a handle that only tracks its own element
 * drops the drag the moment you move faster than it redraws.
 */
export function Splitter({ onDrag, onReset }: SplitterProps) {
  const [dragging, setDragging] = useState(false)

  const start = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      setDragging(true)

      const move = (moved: globalThis.MouseEvent): void => onDrag(moved.clientX)

      const stop = (): void => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', stop)
        setDragging(false)
      }

      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', stop)
    },
    [onDrag],
  )

  return (
    <div
      className={dragging ? 'splitter splitter--dragging' : 'splitter'}
      onDoubleClick={onReset}
      onMouseDown={start}
      title="Drag to resize · double-click to reset"
    >
      <span className="splitter__line" />
    </div>
  )
}
