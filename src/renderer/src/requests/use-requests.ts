import { useCallback, useEffect, useMemo, useState } from 'react'
import { REQUEST_PAYLOAD_TYPE } from '../../../shared/ray-event'
import type { TabKey } from './tabs'
import { toHttpRequest } from './to-http-request'
import {
  hasNPlusOne,
  isPreflight,
  SLOW_REQUEST_MS,
  type HttpRequest,
  type RequestFilter,
} from './types'

/**
 * One collected request carries every query it ran, so the list is kept far
 * shorter than the event stream's buffer.
 */
const MAX_REQUESTS = 100

/** Everything RequestsView needs, owned one level up so it outlives the view. */
export type RequestsState = ReturnType<typeof useRequests>

/**
 * Owns the list state the way use-ray-events owns the stream's, and subscribes
 * to the same event channel — requests arrive as `netos_request` payloads from
 * the Laravel middleware, which the stream skips.
 *
 * Called from App rather than from RequestsView: the view unmounts whenever the
 * Stream tab is shown, and a hook that lives inside it would take the collected
 * requests with it and stop listening until someone looked again.
 */
export function useRequests() {
  const [requests, setRequests] = useState<HttpRequest[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RequestFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Up here for the same reason as the rest: the view unmounts on every switch.
  const [tab, setTab] = useState<TabKey>('queries')

  useEffect(
    () =>
      window.ray.onEvent((event) => {
        if (event.type === 'clear_all') {
          setRequests([])
          setSelectedId(null)

          return
        }

        if (event.type !== REQUEST_PAYLOAD_TYPE) {
          return
        }

        const request = toHttpRequest(event.content)

        if (request === null) {
          return
        }

        // Newest first, matching the order the list renders in.
        setRequests((current) => [request, ...current].slice(0, MAX_REQUESTS))
      }),
    [],
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return requests.filter((request) => {
      if (needle && !`${request.method} ${request.uri}`.toLowerCase().includes(needle)) {
        return false
      }

      if (filter === 'options') {
        return isPreflight(request)
      }

      if (isPreflight(request)) {
        return false
      }

      if (filter === 'errors') {
        return request.status >= 400
      }

      if (filter === 'slow') {
        return request.durationMs >= SLOW_REQUEST_MS
      }

      if (filter === 'n1') {
        return hasNPlusOne(request)
      }

      return true
    })
  }, [requests, query, filter])

  const preflightCount = useMemo(() => requests.filter(isPreflight).length, [requests])

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  )

  const reset = useCallback(() => {
    setQuery('')
    setFilter('all')
  }, [])

  const clear = useCallback(() => {
    setRequests([])
    setSelectedId(null)
  }, [])

  return {
    shown,
    selected,
    selectedId,
    setSelectedId,
    query,
    setQuery,
    filter,
    setFilter,
    reset,
    clear,
    tab,
    setTab,
    preflightCount,
    total: requests.length,
  }
}
