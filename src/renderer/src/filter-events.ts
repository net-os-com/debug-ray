import type { RayEvent } from '../../shared/ray-event'
import { eventPreview } from './event-preview'
import { eventTitle } from './event-title'
import { kindFor } from './kind'

export const ALL = 'all'

/**
 * Which end of the stream is the top of the list.
 *
 * Events are stored oldest first, which is the order they arrived in. 'newest'
 * turns that round for the display; 'oldest' reads it as it is.
 */
export type StreamOrder = 'newest' | 'oldest'

export type Filters = {
  source: string
  kind: string
  label: string
  query: string
}

export function sourceOf(event: RayEvent): string {
  return event.origin.hostname ?? 'unknown host'
}

export function filterEvents(
  events: RayEvent[],
  filters: Filters,
  labels: Record<string, string>,
  order: StreamOrder = 'newest',
): RayEvent[] {
  const query = filters.query.trim().toLowerCase()

  const shown = events
    .filter((event) => {
      if (filters.source !== ALL && sourceOf(event) !== filters.source) {
        return false
      }

      if (filters.kind !== ALL && kindFor(event).key !== filters.kind) {
        return false
      }

      if (filters.label !== ALL && labels[event.uuid] !== filters.label) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        eventTitle(event),
        eventPreview(event),
        event.origin.file ?? '',
        event.type,
        kindFor(event).key,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })

  // Stored oldest first, because that is the order they arrived in. Only the
  // display turns round, and `filter` already returned a new array, so the
  // reverse is in place rather than over a copy.
  return order === 'newest' ? shown.reverse() : shown
}
