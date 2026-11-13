import type { RayEvent } from '../../shared/ray-event'

/**
 * Splits what the main process kept into what a window should list and what
 * should wait for the stream to resume.
 *
 * A window that opens while the stream is paused would otherwise list
 * everything, including what arrived after the pause — which the windows that
 * were open all along are holding back. An event that arrived in the very
 * millisecond the pause began counts as arriving during it.
 */
export function splitAtPause(
  events: RayEvent[],
  since: number | null,
): { shown: RayEvent[]; pending: RayEvent[] } {
  if (since === null) {
    return { shown: events, pending: [] }
  }

  return {
    shown: events.filter((event) => event.receivedAt < since),
    pending: events.filter((event) => event.receivedAt >= since),
  }
}
