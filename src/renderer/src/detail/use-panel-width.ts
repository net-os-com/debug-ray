import { useCallback, useEffect, useState } from 'react'

/** The width the design gives the detail panel. */
export const DEFAULT_WIDTH = 420

const MIN_WIDTH = 320

/** Leave the stream usable no matter how far the handle is dragged. */
const MIN_STREAM_WIDTH = 360

const KEY = 'netos-ray.detail-width'

function stored(): number {
  try {
    const raw = Number(localStorage.getItem(KEY))

    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

export function clampWidth(width: number, containerWidth: number): number {
  const max = Math.max(MIN_WIDTH, containerWidth - MIN_STREAM_WIDTH)

  return Math.min(Math.max(width, MIN_WIDTH), max)
}

export function usePanelWidth() {
  const [width, setWidth] = useState<number>(stored)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(width))
    } catch {
      // A blocked storage should never break resizing.
    }
  }, [width])

  const resize = useCallback((next: number, containerWidth: number) => {
    setWidth(clampWidth(next, containerWidth))
  }, [])

  const reset = useCallback(() => setWidth(DEFAULT_WIDTH), [])

  return { width, resize, reset }
}
