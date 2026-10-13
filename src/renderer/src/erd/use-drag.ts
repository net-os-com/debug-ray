import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from './arrange'

/**
 * Drags something that sits inside the zoomed layer.
 *
 * The listeners go on the window rather than on the element: a fast drag leaves
 * the element behind, and a listener bound to it stops receiving moves the
 * moment the pointer outruns it. The screen delta is divided by the zoom
 * because the element lives in a scaled layer — without it a card crawls behind
 * the cursor when zoomed out and runs ahead when zoomed in.
 */
export function useDrag(
  at: Point,
  zoom: number,
  onMove: (point: Point) => void,
): (event: ReactPointerEvent) => void {
  return (event) => {
    const start = { x: event.clientX, y: event.clientY }
    const origin = { ...at }
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
  }
}
