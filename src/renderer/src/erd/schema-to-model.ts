import type { SchemaIndex, SchemaKey, SchemaTable } from '../../../shared/tools'
import {
  LANDLORD,
  qualify,
  TENANT,
  type ErdColumn,
  type ErdModel,
  type ErdRelation,
  type ErdTable,
} from './model'

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
  // The design names the two databases rather than numbering them: the central
  // one is the landlord, and anything else is a tenant database. That name is
  // what DBML writes as the schema prefix, so an import round-trips as
  // `Table landlord.users` rather than losing which database a table came from.
  const scope = database === centralDatabase || database === '' ? LANDLORD : TENANT

  return {
    tables: readable.map((table) => toTable(table, scope)),
    relations: readable.flatMap((table) =>
      toRelations(table, scope, database, centralDatabase, known),
    ),
    // A live database has neither: an enum is a DBML declaration, and a group
    // is a drawing instruction. Both arrive only from a hand-written source.
    enums: [],
    groups: [],
    notes: [],
  }
}

function toTable(table: SchemaTable, scope: string): ErdTable {
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
        references.set(column, { table: qualify(scope, key.table), column: foreign })
      }
    })
  }

  return {
    name: qualify(scope, table.name),
    label: table.name,
    scope,
    headerColor: null,
    note: null,
    columns: table.columns.map((column): ErdColumn => ({
      name: column.name,
      type: column.type,
      nullable: column.nullable,
      primary: primary.has(column.name),
      unique: unique.has(column.name),
      increment: column.autoIncrement === true,
      defaultValue: column.default === null || column.default === '' ? null : column.default,
      note: null,
      references: references.get(column.name) ?? null,
    })),
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
  scope: string,
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

      const crossDatabase = !known.has(key.table) && database !== centralDatabase

      return [
        {
          from: { table: qualify(scope, table.name), column },
          // A key whose target this reader never saw points at the central
          // database, so it is qualified as the landlord's rather than as one
          // of ours.
          to: {
            table: qualify(crossDatabase ? LANDLORD : scope, key.table),
            column: foreign,
          },
          onDelete: key.onDelete,
          crossDatabase,
        },
      ]
    }),
  )
}
