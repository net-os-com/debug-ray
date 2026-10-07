/** "just now", "12s ago", "4m ago" — the detail panel still shows the exact time. */
export function relativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1_000))

  if (seconds < 5) {
    return 'just now'
  }

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.round(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  return `${Math.round(minutes / 60)}h ago`
}
