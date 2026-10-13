import { Parser } from '@dbml/core'
import type { ErdColumn, ErdModel, ErdRelation, ErdTable } from './model'

export type SourceRange = { start: number; end: number }

export type ParsedTable = {
  name: string
  /** The whole `Table x { … }` block. */
  range: SourceRange
  /** Each column's own line, keyed by column name. */
  columns: Record<string, SourceRange>
  /** A zero-width range on the closing brace, where a new column is inserted. */
  body: SourceRange
}

export type Parsed =
  | { ok: true; model: ErdModel; tables: Record<string, ParsedTable> }
  | { ok: false; line: number; column: number; message: string }

/** What the library hands back, named here so nothing downstream guesses. */
type RawToken = { start: { offset: number }; end: { offset: number } }
type RawField = {
  token: RawToken
  name: string
  type: { type_name: string }
  pk?: boolean
  unique?: boolean
  not_null?: boolean
}
type RawIndex = { name?: string | null; columns: { value: string }[]; unique?: boolean; pk?: boolean }
type RawTable = {
  token: RawToken
  name: string
  fields: RawField[]
  indexes: RawIndex[]
  note?: string | null
}
type RawEnum = { name: string; values: { name: string }[] }
type RawGroup = { name: string; tables: { name: string }[] }
type RawEndpoint = { tableName: string; fieldNames: string[]; relation: string }
type RawRef = { onDelete?: string | null; endpoints: RawEndpoint[] }
type RawSchema = { tables: RawTable[]; refs: RawRef[]; enums: RawEnum[]; tableGroups?: RawGroup[] }

/**
 * Turns DBML source into the model the canvas draws, and the byte ranges a
 * patch needs to change one line without touching the rest of the file.
 */
export function parseDbml(code: string): Parsed {
  let schema: RawSchema | undefined

  try {
    const database = Parser.parse(code, 'dbml') as unknown as { schemas: RawSchema[] }

    schema = database.schemas[0]
  } catch (error) {
    return failure(error)
  }

  if (schema === undefined) {
    return { ok: true, model: { tables: [], relations: [], enums: [], groups: [] }, tables: {} }
  }

  const tables: Record<string, ParsedTable> = {}
  const modelTables: ErdTable[] = []

  for (const table of schema.tables) {
    const columns: Record<string, SourceRange> = {}

    for (const field of table.fields) {
      // Extended back to the start of the line: the parser reports the first
      // field from its first non-space character but later ones from their
      // indent, so a rewrite that re-indents grew the line every time.
      const start = code.lastIndexOf('\n', field.token.start.offset - 1) + 1

      columns[field.name] = { start, end: field.token.end.offset }
    }

    const range = { start: table.token.start.offset, end: table.token.end.offset }
    // Insert before the closing brace rather than at the block's end, so a new
    // column lands inside the table instead of after it.
    const brace = code.lastIndexOf('}', range.end)
    const anchor = brace < range.start ? range.end : brace

    tables[table.name] = { name: table.name, range, columns, body: { start: anchor, end: anchor } }

    const primary = new Set(
      table.indexes
        .filter((index) => index.pk === true)
        .flatMap((index) => index.columns.map((column) => column.value)),
    )

    modelTables.push({
      name: table.name,
      // DBML carries no database; the canvas stopped reading this field when the
      // per-card badge was dropped.
      database: '',
      note: typeof table.note === 'string' && table.note !== '' ? table.note : null,
      columns: table.fields.map(
        (field): ErdColumn => ({
          name: field.name,
          type: field.type.type_name,
          nullable: field.not_null !== true,
          primary: field.pk === true || primary.has(field.name),
          unique: field.unique === true,
          references: null,
        }),
      ),
      indexes: table.indexes
        .filter((index) => index.pk !== true)
        .map((index) => ({
          name: index.name ?? '',
          columns: index.columns.map((column) => column.value),
          unique: index.unique === true,
        })),
    })
  }

  return {
    ok: true,
    model: {
      tables: modelTables,
      relations: relations(schema),
      enums: schema.enums.map((one) => ({
        name: one.name,
        values: one.values.map((value) => value.name),
      })),
      // `tableGroups` is absent, not empty, on a schema that declares none.
      groups: (schema.tableGroups ?? []).map((one) => ({
        name: one.name,
        tables: one.tables.map((table) => table.name),
      })),
    },
    tables,
  }
}

function relations(schema: RawSchema): ErdRelation[] {
  const out: ErdRelation[] = []

  for (const ref of schema.refs) {
    // Endpoints are [many, one]; the many side is the one holding the key.
    const many = ref.endpoints.find((end) => end.relation === '*') ?? ref.endpoints[0]
    const one = ref.endpoints.find((end) => end !== many)

    if (many === undefined || one === undefined) {
      continue
    }

    many.fieldNames.forEach((field, index) => {
      const target = one.fieldNames[index]

      if (target !== undefined) {
        out.push({
          from: { table: many.tableName, column: field },
          to: { table: one.tableName, column: target },
          onDelete: ref.onDelete ?? '',
          crossDatabase: false,
        })
      }
    })
  }

  return out
}

/**
 * The parser throws an error carrying a `diags` array, not a message and a
 * location of its own — reading the outer object reports every failure as line
 * one with no text worth showing.
 */
function failure(error: unknown): Parsed {
  const thrown = error as {
    diags?: { message?: string; location?: { start?: { line?: number; column?: number } } }[]
  }
  const first = thrown.diags?.[0]
  const start = first?.location?.start

  return {
    ok: false,
    line: typeof start?.line === 'number' ? start.line : 1,
    column: typeof start?.column === 'number' ? start.column : 1,
    message: typeof first?.message === 'string' ? first.message : String(error),
  }
}
