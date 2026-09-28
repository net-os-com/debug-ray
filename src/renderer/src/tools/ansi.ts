export type AnsiSpan = {
  text: string
  color: string | null
  bold: boolean
  dim: boolean
}

/** The eight colours a console actually uses, mapped onto the app's own. */
const COLORS: Record<number, string> = {
  30: 'var(--t3)',
  31: 'var(--err-fg)',
  32: 'var(--ok-fg)',
  33: 'var(--sql-num)',
  34: 'var(--sql-kw)',
  35: 'var(--ansi-magenta)',
  36: 'var(--ansi-cyan)',
  37: 'var(--t1)',
}

/** Anything that is not a colour instruction: cursor moves, erases, titles. */
// The final class deliberately skips `m`: that is the colour terminator, and
// an earlier version swallowed every SGR sequence by including it in `f-n`.
const OTHER_ESCAPES = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[[(][0-9;?]*[A-PRZcf-ln-qry=><]|[\r\b]/g

const SGR = /\x1b\[([0-9;]*)m/g

/**
 * Turns one line of console output into coloured spans.
 *
 * Artisan and Pail lean on colour to say what matters — a red failure, a yellow
 * warning — so stripping it would leave the one thing you are scanning for
 * looking like everything else. Only the SGR codes are read; every other escape
 * is removed, because a cursor move means nothing in a pane that never
 * rewrites a line.
 */
export function parseAnsi(line: string): AnsiSpan[] {
  const clean = line.replace(OTHER_ESCAPES, '')
  const spans: AnsiSpan[] = []

  let color: string | null = null
  let bold = false
  let dim = false
  let cursor = 0

  SGR.lastIndex = 0

  for (let match = SGR.exec(clean); match !== null; match = SGR.exec(clean)) {
    if (match.index > cursor) {
      spans.push({ text: clean.slice(cursor, match.index), color, bold, dim })
    }

    for (const code of (match[1] === '' ? '0' : (match[1] as string)).split(';')) {
      const value = Number(code)

      if (value === 0) {
        color = null
        bold = false
        dim = false
      } else if (value === 1) {
        bold = true
      } else if (value === 2) {
        dim = true
      } else if (value === 22) {
        bold = false
        dim = false
      } else if (value === 39) {
        color = null
      } else if (COLORS[value] !== undefined) {
        color = COLORS[value] as string
      } else if (value >= 90 && value <= 97) {
        color = COLORS[value - 60] as string
      }
    }

    cursor = match.index + match[0].length
  }

  if (cursor < clean.length) {
    spans.push({ text: clean.slice(cursor), color, bold, dim })
  }

  return spans.length === 0 ? [{ text: clean, color: null, bold: false, dim: false }] : spans
}
