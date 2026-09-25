import { duplicateQueries, type HttpRequest, type Measure } from './types'

/** The design's six bands, with the token each one draws in. */
export const TIMELINE_COLORS = {
  boot: { label: 'Framework', color: 'var(--t3)' },
  mw: { label: 'Middleware', color: 'var(--sql-num)' },
  ctrl: { label: 'Controller', color: 'var(--sql-kw)' },
  db: { label: 'Database', color: 'var(--warn-line)' },
  n1: { label: 'N+1', color: 'var(--err-fg)' },
  res: { label: 'Response', color: 'var(--ok-fg)' },
} as const

export type Band = keyof typeof TIMELINE_COLORS

export type Span = Measure & {
  /** How deeply this measure nests inside the ones around it. */
  depth: number
  band: Band
  /** Percentages across the request, ready for `left` and `width`. */
  left: string
  width: string
}

export type Tick = { label: string; left: string; at: number }

/**
 * Debugbar hands back a flat list of measures that overlap — `Routing` runs
 * inside `Application`, and every query runs inside whatever called it. The
 * design draws that nesting as indentation, so it is reconstructed here by
 * containment rather than asked of the collector, which does not track it.
 */
export function spansOf(request: HttpRequest): Span[] {
  const total = request.durationMs || 1
  const duplicates = new Set(duplicateQueries(request).map((query) => query.sql))

  const ordered = [...request.timeline].sort(
    (a, b) => a.offsetMs - b.offsetMs || b.durationMs - a.durationMs,
  )

  const open: Measure[] = []

  return ordered.map((measure) => {
    const end = measure.offsetMs + measure.durationMs

    // Anything that closed at or before this one starts is no longer a parent.
    // `<=` matters: Booting ends exactly where Application begins, and with a
    // strict `<` the whole request nests itself one level too deep.
    while (open.length > 0 && endOf(open[open.length - 1]) <= measure.offsetMs) {
      open.pop()
    }

    const depth = open.length

    open.push(measure)

    return {
      ...measure,
      depth,
      band: bandOf(measure, duplicates),
      left: percent(measure.offsetMs, total),
      width: percent(Math.max(end - measure.offsetMs, 0), total),
    }
  })
}

/** Only the bands actually on screen, so the key explains what is drawn. */
export function legendOf(spans: Span[]): { band: Band; label: string; color: string }[] {
  const present = new Set(spans.map((span) => span.band))

  return (Object.keys(TIMELINE_COLORS) as Band[])
    .filter((band) => present.has(band))
    .map((band) => ({ band, ...TIMELINE_COLORS[band] }))
}

/**
 * Round marks across the request — 1, 2 or 5 times a power of ten — so the
 * axis reads in numbers a person would have picked. Five is what the canvas
 * uses: its 412 ms request is marked every 100 ms.
 */
export function ticksOf(totalMs: number, target = 5): Tick[] {
  if (!(totalMs > 0)) {
    return []
  }

  const rough = totalMs / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= rough) ?? magnitude * 10

  const ticks: Tick[] = []

  for (let at = 0; at <= totalMs; at += step) {
    ticks.push({ at, label: '', left: percent(at, totalMs) })
  }

  return ticks
}

function bandOf(measure: Measure, duplicates: Set<string>): Band {
  if (measure.collector === 'queries') {
    return duplicates.has(measure.label) ? 'n1' : 'db'
  }

  const label = measure.label.toLowerCase()

  if (label.includes('boot') || label.includes('terminat')) {
    return 'boot'
  }

  if (label.includes('response') || label.includes('sending')) {
    return 'res'
  }

  if (label.includes('rout') || label.includes('middleware')) {
    return 'mw'
  }

  return 'ctrl'
}

function endOf(measure: Measure): number {
  return measure.offsetMs + measure.durationMs
}

function percent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(2)}%`
}
