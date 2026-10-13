import { quoteName, quoteType } from './dbml'
import type { ErdColumn } from './model'
import { parseDbml, type Parsed, type SourceRange } from './parse'

export type PatchResult = { ok: true; code: string } | { ok: false; reason: string }

type Good = Extract<Parsed, { ok: true }>

/**
 * The single way the source is changed.
 *
 * It re-parses first, so a range computed from an older parse is never used
 * against newer text; and re-parses after, so a patch that breaks the document
 * is reported instead of saved. The text is the record — a control on the
 * canvas must not be able to corrupt it.
 */
function patch(
  code: string,
  locate: (parsed: Good) => SourceRange | string,
  render: () => string,
): PatchResult {
  const before = parseDbml(code)

  if (!before.ok) {
    return { ok: false, reason: 'The source does not parse, so it cannot be edited from the canvas.' }
  }

  const where = locate(before)

  if (typeof where === 'string') {
    return { ok: false, reason: where }
  }

  const next = code.slice(0, where.start) + render() + code.slice(where.end)
  const after = parseDbml(next)

  if (!after.ok) {
    return { ok: false, reason: `That change would break the file at line ${after.line}: ${after.message}` }
  }

  return { ok: true, code: next }
}

function columnRange(parsed: Good, table: string, column: string): SourceRange | string {
  return parsed.tables[table]?.columns[column] ?? `No column ${table}.${column} in the source.`
}

function columnOf(parsed: Good, table: string, column: string): ErdColumn | null {
  return (
    parsed.model.tables.find((one) => one.name === table)?.columns.find((one) => one.name === column) ??
    null
  )
}

/** The settings this file knows how to rewrite. Everything else is carried. */
const OWNED = new Set(['pk', 'unique', 'null', 'not null'])

type Change = {
  name?: string
  type?: string
  primary?: boolean
  unique?: boolean
  nullable?: boolean
}

/**
 * Rewrites one column line, keeping everything the change does not name.
 *
 * Regenerating the line from the model was wrong in three ways at once. It
 * dropped every setting the model does not carry — `increment`, `note:`,
 * `default:`, an inline `ref:` — and the result still parsed, so nothing caught
 * it: one flag toggle silently deleted a hand-written note. It wrote an
 * explicit `pk` for a column that was only part of a composite index, leaving
 * the file with two different primary keys. And it re-indented from scratch,
 * so an edit grew the line by two spaces every time.
 *
 * So the original line is the base: its indentation, its unknown settings and
 * any flag the caller did not ask about all survive untouched.
 */
function rewriteColumnLine(original: string, change: Change): string {
  const indent = original.match(/^[ \t]*/)?.[0] ?? '  '
  const trailing = original.endsWith('\n') ? '\n' : ''
  const body = original.trim()
  const open = body.lastIndexOf('[')
  const close = body.lastIndexOf(']')
  const hasSettings = open > 0 && close > open
  const head = (hasSettings ? body.slice(0, open) : body).trim()
  const existing = hasSettings ? splitSettings(body.slice(open + 1, close)) : []

  // The head is `name type`; the type may itself be quoted and contain spaces.
  const space = head.indexOf(' ')
  const currentName = space < 0 ? head : head.slice(0, space)
  const currentType = space < 0 ? '' : head.slice(space + 1).trim()

  const name = change.name === undefined ? currentName : quoteName(change.name)
  const type = change.type === undefined ? currentType : quoteType(change.type)

  const kept = existing.filter((one) => !OWNED.has(one.toLowerCase()))
  const flags: string[] = []

  // A flag the caller did not mention keeps whatever the line already said.
  const had = (token: string): boolean => existing.some((one) => one.toLowerCase() === token)

  if (change.primary ?? had('pk')) {
    flags.push('pk')
  }

  if (change.unique ?? had('unique')) {
    flags.push('unique')
  }

  if (change.nullable === undefined) {
    if (had('null')) {
      flags.push('null')
    } else if (had('not null')) {
      flags.push('not null')
    }
  } else {
    flags.push(change.nullable ? 'null' : 'not null')
  }

  const settings = [...flags, ...kept]

  return `${indent}${name} ${type}${settings.length > 0 ? ` [${settings.join(', ')}]` : ''}${trailing}`
}

/** Splits on commas that are not inside quotes, so `note: 'a, b'` stays whole. */
function splitSettings(text: string): string[] {
  const out: string[] = []
  let current = ''
  let quote: string | null = null

  for (const character of text) {
    if (quote !== null) {
      current += character

      if (character === quote) {
        quote = null
      }

      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
      current += character

      continue
    }

    if (character === ',') {
      out.push(current.trim())
      current = ''

      continue
    }

    current += character
  }

  if (current.trim() !== '') {
    out.push(current.trim())
  }

  return out.filter((one) => one !== '')
}

/**
 * Every column edit is the same shape: find its line, rewrite the parts the
 * change names, splice. The rewrite reads the original line rather than the
 * model, so nothing the model does not carry is lost.
 */
function editColumn(code: string, table: string, column: string, change: Change): PatchResult {
  let line = ''

  return patch(
    code,
    (parsed) => {
      const range = parsed.tables[table]?.columns[column]

      if (range === undefined) {
        return `No column ${table}.${column} in the source.`
      }

      line = rewriteColumnLine(code.slice(range.start, range.end), change)

      return range
    },
    () => line,
  )
}

export function renameColumn(code: string, table: string, column: string, to: string): PatchResult {
  return editColumn(code, table, column, { name: to })
}

export function retypeColumn(code: string, table: string, column: string, type: string): PatchResult {
  return editColumn(code, table, column, { type })
}

export function setColumnFlags(
  code: string,
  table: string,
  column: string,
  flags: { primary?: boolean; unique?: boolean; nullable?: boolean },
): PatchResult {
  return editColumn(code, table, column, flags)
}

/** The whole line goes, newline included, so no blank line is left behind. */
export function deleteColumn(code: string, table: string, column: string): PatchResult {
  return patch(code, (parsed) => columnRange(parsed, table, column), () => '')
}

/**
 * Inserts after the last field rather than before the closing brace: an
 * `indexes { … }` block sits between the two, and the grammar does not allow a
 * field after it. Anchoring on the brace made this refuse on every table that
 * has an index, which is most of them.
 */
export function addColumn(code: string, table: string, column: ErdColumn): PatchResult {
  return patch(
    code,
    (parsed) => {
      const found = parsed.tables[table]

      if (found === undefined) {
        return `No table named ${table} in the source.`
      }

      const ends = Object.values(found.columns).map((range) => range.end)

      return ends.length === 0 ? found.body : { start: Math.max(...ends), end: Math.max(...ends) }
    },
    () => {
      const settings = [
        ...(column.primary ? ['pk'] : []),
        ...(column.unique ? ['unique'] : []),
        column.nullable ? 'null' : 'not null',
      ]

      return `  ${quoteName(column.name)} ${quoteType(column.type)} [${settings.join(', ')}]\n`
    },
  )
}

/**
 * `[headercolor: #rrggbb]` sits on the Table line. Rather than take that line
 * apart, the whole header is re-rendered from the name the parser gave us.
 */
export function setHeaderColor(code: string, table: string, color: string | null): PatchResult {
  return patch(
    code,
    (parsed) => {
      const found = parsed.tables[table]

      if (found === undefined) {
        return `No table named ${table} in the source.`
      }

      const open = code.indexOf('{', found.range.start)

      return open < 0 ? `Table ${table} has no body.` : { start: found.range.start, end: open }
    },
    () => (color === null ? `Table ${quoteName(table)} ` : `Table ${quoteName(table)} [headercolor: ${color}] `),
  )
}
