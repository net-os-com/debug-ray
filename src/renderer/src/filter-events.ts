import type { RayEvent } from '../../shared/ray-event'
import { eventPreview } from './event-preview'
import { eventTitle } from './event-title'
import { kindFor } from './kind'

export const ALL = 'all'

export type Filters = {
  source: string
  kind: string
  label: string
  query: string
}

export function sourceOf(event: RayEvent): string {
  return event.origin.hostname ?? 'unknown host'
}

/** Newest first, the way the canvas orders the stream. */
export function filterEvents(
  events: RayEvent[],
  filters: Filters,
  labels: Record<string, string>,
): RayEvent[] {
  const query = filters.query.trim().toLowerCase()

  return events
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
    .slice()
    .reverse()
}
