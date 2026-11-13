/**
 * The best score as read back from settings, which nothing validates on the
 * way in. A value that is not a positive finite number would otherwise turn
 * the best into NaN, and no score is ever greater than NaN — so no new best
 * would ever be kept again.
 */
export function bestScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}
