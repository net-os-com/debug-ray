/**
 * The one place a duration becomes text.
 *
 * Whole milliseconds, because a third decimal on a 385 ms request is noise, and
 * seconds past a thousand, because four-digit millisecond counts are hard to
 * read. Sub-millisecond values are shown as `<1 ms` rather than rounded to
 * `0 ms` — most queries sit there, and a list of zeroes says nothing.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return '—'
  }

  if (Math.abs(ms) >= 1000) {
    return `${(ms / 1000).toFixed(1)} s`
  }

  if (ms > 0 && ms < 1) {
    return '<1 ms'
  }

  return `${Math.round(ms)} ms`
}

/** Same rules, for a value that arrives in seconds (ray's measure payloads). */
export function formatSeconds(seconds: number): string {
  return formatDuration(seconds * 1000)
}
