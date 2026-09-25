import { useCallback, useEffect, useState } from 'react'
import { readPreference, writePreference } from '../preferences'

const KEY = 'tinkerSideWidth'

/** The width the canvas gives the snippet list. */
export const DEFAULT_SIDE_WIDTH = 264

const MIN = 180
const MAX = 440

function stored(): number {
  const raw = Number(readPreference(KEY, DEFAULT_SIDE_WIDTH))

  return Number.isFinite(raw) && raw >= MIN && raw <= MAX ? raw : DEFAULT_SIDE_WIDTH
}

export function useSideWidth() {
  const [width, setWidth] = useState<number>(stored)

  useEffect(() => {
    writePreference(KEY, width)
  }, [width])

  return {
    width,
    resize: useCallback((next: number) => setWidth(Math.min(MAX, Math.max(MIN, next))), []),
    reset: useCallback(() => setWidth(DEFAULT_SIDE_WIDTH), []),
  }
}
