import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HTTP_CLIENT_PAYLOAD_TYPE } from '../../../shared/ray-event'
import { toOutgoingCall, type OutgoingCall } from '../../../shared/http-client'

export type HttpClientState = ReturnType<typeof useHttpClient>

/** Everything, or only the calls that went wrong. */
export type CallFilter = 'all' | 'errors'

/** Which part of one call the detail pane is showing. */
export type CallTab = 'request' | 'response' | 'timing' | 'trace'

type Options = {
  /** How many calls are kept before the oldest drop off. */
  max: number
  /** Off, and the page says so rather than filling up quietly. */
  collect: boolean
}

/** A call that did not arrive, or arrived as something nobody wants to see. */
export function failed(call: OutgoingCall): boolean {
  return call.error !== null || call.status === 0 || call.status >= 400
}

/**
 * The calls this application made, newest first.
 *
 * Owned by App rather than by the view, for the reason the collected requests
 * are: the view unmounts on every tab switch, and a buffer that lives inside it
 * would stop listening the moment somebody looked at something else — which is
 * exactly when the interesting call goes out.
 */
export function useHttpClient({ max, collect }: Options) {
  const [calls, setCalls] = useState<OutgoingCall[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CallFilter>('all')
  const [paused, setPaused] = useState(false)
  const [tab, setTab] = useState<CallTab>('request')
  /**
   * Secrets are hidden until asked for, and the asking is remembered for as
   * long as the app runs but no longer — it is a decision about this sitting,
   * not a setting.
   */
  const [secrets, setSecrets] = useState(false)
  /** Somebody else's frames: off, because the point is to find yours. */
  const [vendorFrames, setVendorFrames] = useState(false)

  // Read inside the listener, which is registered once: a paused list that
  // re-subscribed on every toggle would miss whatever arrived in between.
  const held = useRef(paused)
  held.current = paused

  useEffect(
    () =>
      window.ray.onEvent((event) => {
        if (event.type === 'clear_all') {
          setCalls([])
          setSelectedId(null)

          return
        }

        if (event.type !== HTTP_CLIENT_PAYLOAD_TYPE || !collect || held.current) {
          return
        }

        const call = toOutgoingCall(event.content, event.id)

        if (call === null) {
          return
        }

        setCalls((current) => [call, ...current].slice(0, max))
      }),
    [collect, max],
  )

  const errors = useMemo(() => calls.filter(failed).length, [calls])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = filter === 'errors' ? calls.filter(failed) : calls

    if (needle === '') {
      return matching
    }

    return matching.filter((one) =>
      `${one.method} ${one.url} ${one.status} ${one.context.name ?? ''} ${one.tenant ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [calls, filter, query])

  /**
   * What the longest call in view took, which is what the duration bars are
   * drawn against. A list of five fast calls and one slow one should show that.
   */
  const slowest = useMemo(
    () => shown.reduce((high, one) => Math.max(high, one.durationMs), 1),
    [shown],
  )

  return {
    calls,
    shown,
    slowest,
    counts: { all: calls.length, errors },
    query,
    setQuery,
    filter,
    setFilter,
    paused,
    togglePause: useCallback(() => setPaused((current) => !current), []),
    tab,
    setTab,
    secrets,
    toggleSecrets: useCallback(() => setSecrets((current) => !current), []),
    vendorFrames,
    toggleVendorFrames: useCallback(() => setVendorFrames((current) => !current), []),
    selectedId,
    select: useCallback((id: string | null) => setSelectedId(id), []),
    selected: calls.find((one) => one.id === selectedId) ?? null,
    clear: useCallback(() => {
      setCalls([])
      setSelectedId(null)
    }, []),
    collect,
  }
}
