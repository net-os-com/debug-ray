import type { RayEvent } from '../../shared/ray-event'
import { eventTitle } from './event-title'
import { originLabel } from './origin-label'

/** A banner is read at a glance, and macOS truncates well before this. */
const MAX_TITLE = 120

/**
 * What a macOS notification says for one event.
 *
 * The title is the same headline the stream row shows, so a banner and the list
 * never disagree about what arrived. The body is where the `ray()` call sat,
 * which is the one thing you cannot see from the title.
 */
export function notificationFor(event: RayEvent): { title: string; body: string } {
  // Newlines survive into a banner and turn it into a wall, so a multi-line
  // dump collapses to its first line.
  const title = eventTitle(event).replace(/\s+/g, ' ').trim()

  return {
    title: title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title || event.type,
    body: originLabel(event.origin),
  }
}
