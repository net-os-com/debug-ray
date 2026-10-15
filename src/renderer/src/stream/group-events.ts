import type { RayEvent } from '../../../shared/ray-event'
import type { StreamOrder } from '../filter-events'
import { eventPreview } from '../event-preview'
import { eventTitle } from '../event-title'
import { sourceOf } from '../filter-events'
import { kindFor } from '../kind'
import { originLabel } from '../origin-label'

export type StreamGroup = {
  /**
   * The oldest event of the run. Deliberately not the newest: the row's id is
   * what a selection holds on to, and picking the newest would move it every
   * time another identical event lands, dropping the open detail panel.
   */
  event: RayEvent
  count: number
  /** When the run last fired, which is the time worth showing. */
  latestAt: number
}

/**
 * Folds runs of identical events into one row with a count.
 *
 * Only neighbours fold — a repeat separated by something else stays its own
 * row, so the order of what happened is never rewritten. Two events count as
 * identical when everything the row draws is identical: kind, title, preview,
 * origin and any label or colour. That is the same judgement the reader makes
 * looking at two rows, which is what the folding is standing in for.
 *
 * Note the preview is a truncated rendering, so two payloads that differ only
 * past that cut fold together. They came from the same line of the same file
 * and read the same; keeping them apart would be a distinction without one.
 */
export function groupEvents(
  events: RayEvent[],
  labels: Record<string, string>,
  colors: Record<string, string>,
  order: StreamOrder = 'newest',
): StreamGroup[] {
  const groups: StreamGroup[] = []
  let previousKey: string | null = null

  for (const event of events) {
    const key = identityOf(event, labels, colors)
    const open = groups[groups.length - 1]

    if (open !== undefined && key === previousKey) {
      open.count += 1

      // Which of a run is the representative, and which supplies its time, is
      // the same answer read from two ends. Newest first, each further event
      // is older, so it takes over as the representative and the first one's
      // time stays. Oldest first, the opposite: the first is already the
      // oldest and keeps the row, while each further event carries the time.
      if (order === 'newest') {
        open.event = event
      } else {
        open.latestAt = event.receivedAt
      }

      continue
    }

    groups.push({ event, count: 1, latestAt: event.receivedAt })
    previousKey = key
  }

  return groups
}

function identityOf(
  event: RayEvent,
  labels: Record<string, string>,
  colors: Record<string, string>,
): string {
  return [
    kindFor(event).key,
    eventTitle(event),
    eventPreview(event),
    sourceOf(event),
    originLabel(event.origin),
    labels[event.uuid] ?? '',
    colors[event.uuid] ?? '',
  ].join('\u0000')
}
