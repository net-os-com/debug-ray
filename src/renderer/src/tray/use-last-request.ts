import { useEffect, useState } from 'react'
import { REQUEST_PAYLOAD_TYPE } from '../../../shared/ray-event'
import { toHttpRequest } from '../requests/to-http-request'
import { isPreflight, type HttpRequest } from '../requests/types'
import { latestRequest } from './latest-request'

/**
 * The newest collected request, for the line at the top of the menu bar panel.
 *
 * Starts from what the main process kept, so the panel has one to show the
 * first time it opens, and follows new ones as they arrive. It is not part of
 * the stream, so the stream's pause does not hold it back. Clearing requests
 * anywhere, or a `clear_all`, takes it away.
 */
export function useLastRequest(collect: boolean): HttpRequest | null {
  const [request, setRequest] = useState<HttpRequest | null>(null)

  useEffect(() => {
    let cancelled = false

    void window.ray.getRequestsSnapshot().then((events) => {
      const latest = latestRequest(events)

      // A live request may have landed first; it is newer than anything kept.
      if (!cancelled && latest !== null) {
        setRequest((current) => current ?? latest)
      }
    })

    const stopEvents = window.ray.onEvent((event) => {
      if (event.type === 'clear_all') {
        setRequest(null)

        return
      }

      if (event.type !== REQUEST_PAYLOAD_TYPE) {
        return
      }

      const parsed = toHttpRequest(event.content)

      if (parsed !== null && !isPreflight(parsed)) {
        setRequest(parsed)
      }
    })

    const stopCleared = window.ray.onRequestsCleared(() => setRequest(null))

    return () => {
      cancelled = true
      stopEvents()
      stopCleared()
    }
  }, [])

  return collect ? request : null
}
