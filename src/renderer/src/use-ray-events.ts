import { useCallback, useEffect, useRef, useState } from 'react'
import { OWN_VIEW, type RayEvent } from '../../shared/ray-event'
import { mergeById } from './merge-by-id'
import { splitAtPause } from './split-at-pause'

/** The design's buffer card promises 500 events kept. */
/** Fallback when no buffer size is configured. */
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
  /** How many events to keep before the oldest drop off. */
  maxEvents?: number
}

export function useRayEvents({ paused, onEvent, maxEvents = MAX_EVENTS }: Options) {
  const [events, setEvents] = useState<RayEvent[]>([])
  const [pending, setPending] = useState<RayEvent[]>([])
  const [labels, setLabels] = useState<Annotations>({})
  const [confettiAt, setConfettiAt] = useState(0)
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

        // Collected requests and outgoing calls belong to their own views,
        // which subscribe to this same channel and pick them up there. Checked
        // against the shared set rather than by name, which is how outgoing
        // calls ended up listed here in the first place.
        if (OWN_VIEW.has(event.type)) {
          return
        }

        if (event.type === 'confetti') {
          setConfettiAt(Date.now())

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
          setPending((current) => [...current, event].slice(-maxEvents))

          return
        }

        setEvents((current) => [...current, event].slice(-maxEvents))
      }),
    [],
  )

  // A window that opens after events arrived — the menu bar panel, or this
  // window closed and opened again — starts from what the main process kept
  // rather than from nothing. Live events may land before the answer does, so
  // the two are merged rather than one replacing the other. What arrived while
  // the stream is paused waits, as it does in the windows that were open.
  useEffect(() => {
    let cancelled = false

    void Promise.all([window.ray.getStreamSnapshot(), window.ray.getPause()]).then(
      ([snapshot, pause]) => {
        if (cancelled) {
          return
        }

        const { shown, pending: waiting } = splitAtPause(snapshot.events, pause.since)

        setEvents((current) => mergeById(shown, current).slice(-maxEvents))
        setPending((current) => mergeById(waiting, current).slice(-maxEvents))
        setLabels((current) => ({ ...snapshot.labels, ...current }))
        setColors((current) => ({ ...snapshot.colors, ...current }))
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  // A clear from anywhere empties this list too: the panel follows the window,
  // and the window hears its own clear back, which is harmless.
  useEffect(
    () =>
      window.ray.onStreamCleared(() => {
        setEvents([])
        setPending([])
      }),
    [],
  )

  // Nothing is dropped while paused; the buffer flushes on resume.
  useEffect(() => {
    if (paused || pending.length === 0) {
      return
    }

    // By id, because a window that opened while paused can hold one event in
    // both: live before it learned of the pause, and as waiting in the snapshot.
    setEvents((current) => mergeById(current, pending).slice(-maxEvents))
    setPending([])
  }, [paused, pending])

  const clear = useCallback(() => {
    setEvents([])
    setPending([])
    // The main process keeps its own copy for the menu bar panel and MCP
    // clients; without this they would go on showing what was just cleared.
    window.ray.clearStream()
  }, [])

  return { events, pendingCount: pending.length, labels, colors, confettiAt, clear }
}
