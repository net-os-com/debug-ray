import { useEffect, useState } from 'react'

/** Coarse enough that a stream of a few hundred rows re-renders rarely. */
const TICK_MS = 10_000

const subscribers = new Set<(now: number) => void>()
let timer: ReturnType<typeof setInterval> | null = null

/**
 * A clock shared by every row that shows a relative timestamp.
 *
 * One interval per row would mean hundreds of timers on a busy stream, so all
 * subscribers share a single one, started on the first and stopped on the last.
 */
export function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) {
      return
    }

    const notify = (value: number): void => setNow(value)

    subscribers.add(notify)

    timer ??= setInterval(() => {
      const value = Date.now()

      for (const subscriber of subscribers) {
        subscriber(value)
      }
    }, TICK_MS)

    return () => {
      subscribers.delete(notify)

      if (subscribers.size === 0 && timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }, [enabled])

  return now
}
