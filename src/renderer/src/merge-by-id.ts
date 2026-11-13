import type { RayEvent } from '../../shared/ray-event'

/**
 * `earlier`, followed by whatever in `later` it does not already hold.
 *
 * A window fills its stream from the main process's log while live events are
 * already arriving. Both can carry the same event — it was logged before the
 * snapshot was taken and delivered live after the window subscribed — and the
 * id is what makes it one row instead of two.
 */
export function mergeById(earlier: RayEvent[], later: RayEvent[]): RayEvent[] {
  const seen = new Set(earlier.map((event) => event.id))

  return [...earlier, ...later.filter((event) => !seen.has(event.id))]
}
