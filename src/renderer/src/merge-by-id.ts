/**
 * `earlier`, followed by whatever in `later` it does not already hold.
 *
 * A window fills its stream from the main process's log while live events are
 * already arriving. Both can carry the same event — it was logged before the
 * snapshot was taken and delivered live after the window subscribed — and the
 * id is what makes it one row instead of two. The same holds for requests.
 */
export function mergeById<T extends { id: string }>(earlier: T[], later: T[]): T[] {
  const seen = new Set(earlier.map((item) => item.id))

  return [...earlier, ...later.filter((item) => !seen.has(item.id))]
}
