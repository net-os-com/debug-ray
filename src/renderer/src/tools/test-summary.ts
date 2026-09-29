import { parseAnsi } from './ansi'
import type { StreamLine } from './stream-lines'

export type TestFailure = {
  /** `Tests\Feature\Thing > it does a thing`, as Pest prints it. */
  test: string
  reason: string
}

export type TestSummary = {
  passed: number
  failed: number
  skipped: number
  pending: number
  duration: string
  failures: TestFailure[]
  /** The runner said something conclusive; before that the numbers mean nothing. */
  finished: boolean
}

export const NO_SUMMARY: TestSummary = {
  passed: 0,
  failed: 0,
  skipped: 0,
  pending: 0,
  duration: '',
  failures: [],
  finished: false,
}

/** `Tests:    2 failed, 10 passed (34 assertions)` — one word per count. */
const COUNTS = /\b(\d+)\s+(passed|failed|skipped|pending|todos?|incomplete|risky|warnings?|deprecated)\b/g
const FAILED_LINE = /^\s*FAILED\s+(.+?)\s{2,}(.+?)\s*$/
const DURATION = /^\s*Duration:\s*(\S+)/
const TOTALS = /^\s*Tests:/

/**
 * Pest's own tally, read back off the console.
 *
 * Running the suite already tells you everything in its output; the point of
 * lifting the numbers out is that after four hundred lines of a passing run you
 * should not have to scroll to find out whether it passed.
 */
export function parseSummary(lines: StreamLine[]): TestSummary {
  const summary: TestSummary = { ...NO_SUMMARY, failures: [] }

  for (const line of lines) {
    const text = strip(line.text)

    if (TOTALS.test(text)) {
      summary.finished = true

      for (const [, count, word] of text.matchAll(COUNTS)) {
        add(summary, word, Number(count))
      }

      continue
    }

    const duration = DURATION.exec(text)

    if (duration !== null) {
      summary.duration = duration[1]

      continue
    }

    const failed = FAILED_LINE.exec(text)

    if (failed !== null) {
      summary.failures.push({ test: failed[1].trim(), reason: failed[2].trim() })
    }
  }

  return summary
}

/** Pest counts several flavours of "did not run"; two buckets is enough here. */
function add(summary: TestSummary, word: string, count: number): void {
  if (word === 'passed') {
    summary.passed += count
  } else if (word === 'failed') {
    summary.failed += count
  } else if (word === 'skipped' || word === 'incomplete') {
    summary.skipped += count
  } else {
    summary.pending += count
  }
}

/** The runner is asked for colour, and the numbers are behind it. */
function strip(line: string): string {
  return parseAnsi(line)
    .map((span) => span.text)
    .join('')
}
