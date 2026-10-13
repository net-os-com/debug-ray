import type { SchemaIndex, SchemaKey, SchemaTable } from '../../../shared/tools'
import type { ErdColumn, ErdModel, ErdRelation, ErdTable } from './model'

/**
 * Turns the schema the Tools view already reads into the shape the canvas and
 * the serialiser consume.
 *
 * `primary` and `unique` come from the indexes rather than from the column
 * name, so a composite primary key marks every column it covers instead of
 * only the one that happens to be called `id`.
 */
export function schemaToModel(
  tables: SchemaTable[],
  database: string,
  centralDatabase: string,
): ErdModel {
  // A table the reader could not introspect has no columns, and an empty
  // `Table x { }` block makes the entire file unparseable. One unreadable table
  // is not worth the other thirty-four.
  const readable = tables.filter((table) => table.error === null && table.columns.length > 0)
  const known = new Set(readable.map((table) => table.name))

  return {
    tables: readable.map((table) => toTable(table, database)),
    relations: readable.flatMap((table) => toRelations(table, database, centralDatabase, known)),
  }
}

function toTable(table: SchemaTable, database: string): ErdTable {
  const primary = columnsIn(table.indexes, (index) => index.primary)
  // Flattening is right for a primary key, which the spec asks for, and wrong
  // for a unique index: `unique(role_id, user_id)` does not make `role_id`
  // unique, and saying so would export a different schema than the real one.
  const unique = columnsIn(
    table.indexes,
    (index) => index.unique && !index.primary && index.columns.length === 1,
  )
  const references = new Map<string, { table: string; column: string }>()

  for (const key of table.keys) {
    key.columns.forEach((column, position) => {
      const foreign = key.foreignColumns[position]

      if (foreign !== undefined) {
        references.set(column, { table: key.table, column: foreign })
      }
    })
  }

  return {
    name: table.name,
    database,
    columns: table.columns.map(
      (column): ErdColumn => ({
        name: column.name,
        type: column.type,
        nullable: column.nullable,
        primary: primary.has(column.name),
        unique: unique.has(column.name),
        references: references.get(column.name) ?? null,
      }),
    ),
    indexes: table.indexes
      .filter((index) => !index.primary)
      .map((index) => ({ name: index.name, columns: index.columns, unique: index.unique })),
  }
}

function columnsIn(indexes: SchemaIndex[], match: (index: SchemaIndex) => boolean): Set<string> {
  return new Set(indexes.filter(match).flatMap((index) => index.columns))
}

/**
 * A foreign key whose target is not among the tables we read points at the
 * central database: tenants live in their own, and some keys reach across.
 * MySQL does not enforce those, so they are flagged rather than drawn as if
 * they were real constraints.
 */
function toRelations(
  table: SchemaTable,
  database: string,
  centralDatabase: string,
  known: Set<string>,
): ErdRelation[] {
  return table.keys.flatMap((key: SchemaKey) =>
    key.columns.flatMap((column, position): ErdRelation[] => {
      const foreign = key.foreignColumns[position]

      if (foreign === undefined) {
        return []
      }

      return [
        {
          from: { table: table.name, column },
          to: { table: key.table, column: foreign },
          onDelete: key.onDelete,
          crossDatabase: !known.has(key.table) && database !== centralDatabase,
        },
      ]
    }),
  )
}
