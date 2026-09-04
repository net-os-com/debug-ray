import { useCallback, useEffect, useRef, useState } from 'react'
import type { RayEvent } from '../../shared/ray-event'

/** The design's buffer card promises 500 events kept. */
export const MAX_EVENTS = 500

/**
 * ray()->label() and ray()->green() arrive as their own payloads in a later
 * request that reuses the uuid. Ray attaches them to the entry rather than
 * showing them as entries, so they are kept aside and looked up per uuid.
 */
type Annotations = Record<string, string>

type Options = {
  paused: boolean
  onEvent?: (event: RayEvent) => void
}

export function useRayEvents({ paused, onEvent }: Options) {
  const [events, setEvents] = useState<RayEvent[]>([])
  const [pending, setPending] = useState<RayEvent[]>([])
  const [labels, setLabels] = useState<Annotations>({})
  const [colors, setColors] = useState<Annotations>({})

  const pausedRef = useRef(paused)
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(
    () =>
      window.ray.onEvent((event) => {
        onEventRef.current?.(event)

        if (event.type === 'clear_all') {
          setEvents([])
          setPending([])

          return
        }

        if (event.type === 'label') {
          const label = event.content.label

          if (typeof label === 'string') {
            setLabels((current) => ({ ...current, [event.uuid]: label }))
          }

          return
        }

        if (event.type === 'color') {
          const color = event.content.color

          if (typeof color === 'string') {
            setColors((current) => ({ ...current, [event.uuid]: color }))
          }

          return
        }

        if (pausedRef.current) {
          setPending((current) => [...current, event].slice(-MAX_EVENTS))

          return
        }

        setEvents((current) => [...current, event].slice(-MAX_EVENTS))
      }),
    [],
  )

  // Nothing is dropped while paused; the buffer flushes on resume.
  useEffect(() => {
    if (paused || pending.length === 0) {
      return
    }

    setEvents((current) => [...current, ...pending].slice(-MAX_EVENTS))
    setPending([])
  }, [paused, pending])

  const clear = useCallback(() => {
    setEvents([])
    setPending([])
  }, [])

  return { events, pendingCount: pending.length, labels, colors, clear }
}
