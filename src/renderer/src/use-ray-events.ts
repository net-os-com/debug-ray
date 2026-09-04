import { useCallback, useEffect, useState } from 'react'
import type { RayEvent } from '../../shared/ray-event'

/** Keeps memory bounded during a chatty request; oldest entries fall off. */
const MAX_EVENTS = 2000

export function useRayEvents() {
  const [events, setEvents] = useState<RayEvent[]>([])

  useEffect(
    () =>
      window.ray.onEvent((event) => {
        if (event.type === 'clear_all') {
          setEvents([])

          return
        }

        setEvents((current) => [...current, event].slice(-MAX_EVENTS))
      }),
    [],
  )

  const clear = useCallback(() => setEvents([]), [])

  return { events, clear }
}
