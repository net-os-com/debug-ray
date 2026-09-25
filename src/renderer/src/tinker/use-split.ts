import { useCallback, useEffect, useState } from 'react'
import { readPreference, writePreference } from '../preferences'

const KEY = 'tinkerSplit'

/** Half and half, as the canvas draws it. */
export const DEFAULT_SPLIT = 0.5

/** Neither pane is worth keeping past these, so the handle stops there. */
const MIN = 0.25
const MAX = 0.75

function stored(): number {
  const raw = Number(readPreference(KEY, DEFAULT_SPLIT))

  return Number.isFinite(raw) && raw >= MIN && raw <= MAX ? raw : DEFAULT_SPLIT
}

/** The editor's share of the width; the output pane takes the rest. */
export function useSplit() {
  const [split, setSplit] = useState<number>(stored)

  useEffect(() => {
    writePreference(KEY, split)
  }, [split])

  return {
    split,
    resize: useCallback((ratio: number) => setSplit(Math.min(MAX, Math.max(MIN, ratio))), []),
    reset: useCallback(() => setSplit(DEFAULT_SPLIT), []),
  }
}
