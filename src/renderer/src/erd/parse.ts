import { Parser } from '@dbml/core'
import { prepass } from './prepass'
import {
  PUBLIC,
  qualify,
  type ErdColumn,
  type ErdModel,
  type ErdRelation,
  type ErdTable,
} from './model'

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
  increment?: boolean
  note?: string | null
  dbdefault?: { value: string | number; type: string } | null
}
type RawIndex = {
  name?: string | null
  columns: { value: string }[]
  unique?: boolean
  pk?: boolean
}
type RawTable = {
  token: RawToken
  name: string
  fields: RawField[]
  indexes: RawIndex[]
  note?: string | null
  headerColor?: string | null
  schema?: { name?: string } | null
}
type RawEnum = { name: string; values: { name: string }[] }
type RawGroup = {
  name: string
  tables: { name: string; schema?: { name?: string } | null }[]
}
type RawEndpoint = {
  tableName: string
  schemaName?: string | null
  fieldNames: string[]
  relation: string
}
type RawRef = { onDelete?: string | null; endpoints: RawEndpoint[] }
type RawSchema = {
  name?: string
  tables: RawTable[]
  refs: RawRef[]
  enums: RawEnum[]
  tableGroups?: RawGroup[]
}

/**
 * Turns DBML source into the model the canvas draws, and the byte ranges a
 * patch needs to change one line without touching the rest of the file.
 */
export function parseDbml(source: string): Parsed {
  let schemas: RawSchema[]
  // Group colours and standalone notes are lifted out first; what the parser
  // sees is the same source with those spans blanked, so every offset it
  // reports still indexes the original.
  const lifted = prepass(source)
  const code = lifted.code

  try {
    const database = Parser.parse(code, 'dbml') as unknown as {
      schemas: RawSchema[]
    }

    // Every schema, not the first. `Table landlord.tenants` and
    // `Table tenant.users` land in two schemas of their own and `schemas[0]` is
    // `public`, which on a fully qualified document holds nothing at all — so
    // reading only that one drew an empty canvas for the design's own example.
    schemas = database.schemas
  } catch (error) {
    return failure(error)
  }

  const tables: Record<string, ParsedTable> = {}
  const modelTables: ErdTable[] = []
  const enums: RawEnum[] = schemas.flatMap((one) => one.enums)
  const groups: ErdModel['groups'] = schemas.flatMap((one) =>
    (one.tableGroups ?? []).map((group) => ({
      name: group.name,
      tables: group.tables.map((member) => qualify(member.schema?.name ?? PUBLIC, member.name)),
      color: lifted.colors[group.name] ?? null,
    })),
  )

  for (const schema of schemas) {
    for (const table of schema.tables) {
      const scope = table.schema?.name ?? schema.name ?? PUBLIC
      const key = qualify(scope, table.name)
      const columns: Record<string, SourceRange> = {}

      for (const field of table.fields) {
        // Extended back to the start of the line: the parser reports the first
        // field from its first non-space character but later ones from their
        // indent, so a rewrite that re-indents grew the line every time.
        const start = code.lastIndexOf('\n', field.token.start.offset - 1) + 1

        columns[field.name] = { start, end: field.token.end.offset }
      }

      const range = {
        start: table.token.start.offset,
        end: table.token.end.offset,
      }
      // Insert before the closing brace rather than at the block's end, so a new
      // column lands inside the table instead of after it.
      const brace = code.lastIndexOf('}', range.end)
      const anchor = brace < range.start ? range.end : brace

      tables[key] = {
        name: key,
        range,
        columns,
        body: { start: anchor, end: anchor },
      }

      const primary = new Set(
        table.indexes
          .filter((index) => index.pk === true)
          .flatMap((index) => index.columns.map((column) => column.value)),
      )

      modelTables.push({
        name: key,
        label: table.name,
        scope,
        headerColor:
          typeof table.headerColor === 'string' && table.headerColor !== ''
            ? table.headerColor
            : null,
        // The prepass' note wins: it only has one when the parser could not read
      // the statement, and in that case the parser reports none at all.
      note:
        lifted.tableNotes[key] ??
        lifted.tableNotes[table.name] ??
        (typeof table.note === 'string' && table.note !== '' ? table.note : null),
        columns: table.fields.map((field): ErdColumn => ({
          name: field.name,
          type: field.type.type_name,
          nullable: field.not_null !== true,
          primary: field.pk === true || primary.has(field.name),
          unique: field.unique === true,
          increment: field.increment === true,
          defaultValue:
            field.dbdefault === null || field.dbdefault === undefined
              ? null
              : String(field.dbdefault.value),
          note: typeof field.note === 'string' && field.note !== '' ? field.note : null,
          references: null,
        })),
        indexes: table.indexes
          .filter((index) => index.pk !== true)
          .map((index) => ({
            name: index.name ?? '',
            columns: index.columns.map((column) => column.value),
            unique: index.unique === true,
          })),
      })
    }
  }

  const model: ErdModel = {
    tables: modelTables,
    relations: relations(schemas, modelTables),
    enums: enums.map((one) => ({
      name: one.name,
      values: one.values.map((value) => value.name),
    })),
    groups,
    notes: lifted.notes,
  }

  return { ok: true, model: withReferences(model), tables }
}

/**
 * Marks the local side of every foreign key on the column itself.
 *
 * The card draws a link icon from it and the inspector reports it, and both
 * would otherwise have to search the relation list per row.
 */
function withReferences(model: ErdModel): ErdModel {
  const byName = new Map(model.tables.map((table) => [table.name, table]))

  for (const relation of model.relations) {
    const column = byName
      .get(relation.from.table)
      ?.columns.find((one) => one.name === relation.from.column)

    if (column !== undefined) {
      column.references = {
        table: relation.to.table,
        column: relation.to.column,
      }
    }
  }

  return model
}

function relations(schemas: RawSchema[], tables: ErdTable[]): ErdRelation[] {
  const out: ErdRelation[] = []
  const scopeOf = new Map(tables.map((table) => [table.name, table.scope]))

  for (const ref of schemas.flatMap((one) => one.refs)) {
    // Endpoints are [many, one]; the many side is the one holding the key.
    const many = ref.endpoints.find((end) => end.relation === '*') ?? ref.endpoints[0]
    const one = ref.endpoints.find((end) => end !== many)

    if (many === undefined || one === undefined) {
      continue
    }

    const fromTable = qualify(many.schemaName ?? PUBLIC, many.tableName)
    const toTable = qualify(one.schemaName ?? PUBLIC, one.tableName)

    many.fieldNames.forEach((field, index) => {
      const target = one.fieldNames[index]

      if (target !== undefined) {
        out.push({
          from: { table: fromTable, column: field },
          to: { table: toTable, column: target },
          onDelete: ref.onDelete ?? '',
          // Two different databases, which MySQL cannot enforce a key across.
          crossDatabase: scopeOf.get(fromTable) !== scopeOf.get(toTable),
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
    diags?: {
      message?: string
      location?: { start?: { line?: number; column?: number } }
    }[]
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
