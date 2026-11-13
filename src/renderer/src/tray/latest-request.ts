import type { RayEvent } from '../../../shared/ray-event'
import { toHttpRequest } from '../requests/to-http-request'
import { isPreflight, type HttpRequest } from '../requests/types'

/**
 * The request worth showing at the top of the menu bar panel: the newest one
 * that parses and is not a CORS preflight. A preflight precedes almost every
 * call a browser makes across origins, and would otherwise always be "last".
 *
 * `events` are oldest first, the order the log keeps them in.
 */
export function latestRequest(events: RayEvent[]): HttpRequest | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const request = toHttpRequest(events[index].content)

    if (request !== null && !isPreflight(request)) {
      return request
    }
  }

  return null
}
