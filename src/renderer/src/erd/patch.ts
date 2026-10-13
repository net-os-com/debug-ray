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

/**
 * A patched line is spelled through the same helpers the generator uses, so a
 * column written by an import and one edited on the canvas come out identical.
 */
function columnLine(column: ErdColumn): string {
  const settings = [
    ...(column.primary ? ['pk'] : []),
    ...(column.unique ? ['unique'] : []),
    column.nullable ? 'null' : 'not null',
  ]

  return `  ${quoteName(column.name)} ${quoteType(column.type)} [${settings.join(', ')}]\n`
}

/**
 * Every column edit is the same shape: find it, render it changed, splice.
 *
 * The rendered line is computed while locating, so the column is looked up once
 * and the render step cannot be reached with it missing.
 */
function editColumn(
  code: string,
  table: string,
  column: string,
  change: (current: ErdColumn) => ErdColumn,
): PatchResult {
  let line = ''

  return patch(
    code,
    (parsed) => {
      const current = columnOf(parsed, table, column)

      if (current === null) {
        return `No column ${table}.${column} in the source.`
      }

      line = columnLine(change(current))

      return columnRange(parsed, table, column)
    },
    () => line,
  )
}

export function renameColumn(code: string, table: string, column: string, to: string): PatchResult {
  return editColumn(code, table, column, (current) => ({ ...current, name: to }))
}

export function retypeColumn(code: string, table: string, column: string, type: string): PatchResult {
  return editColumn(code, table, column, (current) => ({ ...current, type }))
}

export function setColumnFlags(
  code: string,
  table: string,
  column: string,
  flags: { primary?: boolean; unique?: boolean; nullable?: boolean },
): PatchResult {
  return editColumn(code, table, column, (current) => ({
    ...current,
    primary: flags.primary ?? current.primary,
    unique: flags.unique ?? current.unique,
    nullable: flags.nullable ?? current.nullable,
  }))
}

/** The whole line goes, newline included, so no blank line is left behind. */
export function deleteColumn(code: string, table: string, column: string): PatchResult {
  return patch(code, (parsed) => columnRange(parsed, table, column), () => '')
}

/** `body` is a zero-width range on the closing brace, so this inserts. */
export function addColumn(code: string, table: string, column: ErdColumn): PatchResult {
  return patch(
    code,
    (parsed) => parsed.tables[table]?.body ?? `No table named ${table} in the source.`,
    () => columnLine(column),
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
