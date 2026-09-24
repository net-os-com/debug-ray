import { useCallback, useMemo, useState } from 'react'
import { REQUESTS } from './fixtures'
import { hasNPlusOne, SLOW_REQUEST_MS, type HttpRequest, type RequestFilter } from './types'

/**
 * Owns the list state the way use-ray-events owns the stream's. The requests
 * themselves are fixtures for now; only this hook has to change when a
 * collector arrives.
 */
export function useRequests() {
  const [requests] = useState<HttpRequest[]>(REQUESTS)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RequestFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(REQUESTS[0]?.id ?? null)

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return requests.filter((request) => {
      if (needle && !`${request.method} ${request.uri}`.toLowerCase().includes(needle)) {
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

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  )

  const reset = useCallback(() => {
    setQuery('')
    setFilter('all')
  }, [])

  return { shown, selected, selectedId, setSelectedId, query, setQuery, filter, setFilter, reset }
}
