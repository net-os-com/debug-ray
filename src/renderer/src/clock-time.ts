/**
 * A timestamp as a 24-hour wall-clock time, the way a row shows it when
 * relative times are off. Shared by the stream and the menu bar panel so the
 * two never disagree about the same event.
 */
export function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false })
}
