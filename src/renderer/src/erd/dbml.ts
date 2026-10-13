import type { ErdColumn, ErdModel, ErdTable } from './model'

/** Anything that is not plainly `[A-Za-z_][A-Za-z0-9_]*` has to be quoted. */
const BARE = /^[A-Za-z_][A-Za-z0-9_]*$/

/** DBML's own structural keywords. */
const DBML_KEYWORDS = ['table', 'ref', 'enum', 'indexes', 'note', 'project', 'tablegroup', 'as']

/**
 * SQL words that DBML itself parses happily as an identifier.
 *
 * They are quoted anyway, because dbdiagram's main output is SQL and a bare
 * `order` survives the diagram only to produce a `CREATE TABLE order` nobody
 * can run. The list is the common English nouns that actually turn up as table
 * and column names, not all of SQL — an unquoted identifier we miss stays
 * exactly as correct as it is today, while quoting one we need not have costs
 * two characters.
 */
const SQL_KEYWORDS = [
  'order', 'group', 'user', 'key', 'index', 'check', 'default', 'values', 'range', 'rank',
  'row', 'rows', 'position', 'system', 'usage', 'zone', 'language', 'level', 'method',
  'option', 'state', 'year', 'month', 'day', 'hour', 'minute', 'second', 'interval',
  'primary', 'foreign', 'references', 'constraint', 'column', 'database', 'schema',
  'select', 'from', 'where', 'having', 'limit', 'offset', 'union', 'join', 'left', 'right',
  'inner', 'outer', 'on', 'by', 'distinct', 'insert', 'update', 'delete', 'create', 'drop',
  'alter', 'desc', 'asc', 'null', 'true', 'false', 'and', 'or', 'not', 'in', 'is', 'like',
  'between', 'case', 'when', 'then', 'else', 'end', 'to', 'with', 'using', 'natural',
]

const RESERVED = new Set([...DBML_KEYWORDS, ...SQL_KEYWORDS])

/**
 * Renders the model as DBML.
 *
 * Written by hand rather than through `@dbml/core`: this pass only ever writes,
 * and the official package carries a full parser and a set of exporters we
 * would not use. When a later pass needs to read a committed file back, that is
 * the moment to take the dependency.
 */
export function toDbml(model: ErdModel): string {
  const blocks = model.tables.map((table) => tableBlock(table))
  const refs = model.relations.map(
    (relation) =>
      `Ref: ${quote(relation.from.table)}.${quote(relation.from.column)} > ` +
      `${quote(relation.to.table)}.${quote(relation.to.column)}` +
      (relation.onDelete === '' ? '' : ` [delete: ${relation.onDelete}]`),
  )

  return `${[...blocks, ...refs].join('\n\n')}\n`
}

function tableBlock(table: ErdTable): string {
  const lines = table.columns.map((column) => `  ${columnLine(column)}`)

  if (table.indexes.length > 0) {
    lines.push('', '  indexes {')

    for (const index of table.indexes) {
      const columns = index.columns.map(quote).join(', ')

      lines.push(`    (${columns})${index.unique ? ' [unique]' : ''}`)
    }

    lines.push('  }')
  }

  return `Table ${quote(table.name)} {\n${lines.join('\n')}\n}`
}

function columnLine(column: ErdColumn): string {
  const settings: string[] = []

  if (column.primary) {
    settings.push('pk')
  }

  if (column.unique) {
    settings.push('unique')
  }

  settings.push(column.nullable ? 'null' : 'not null')

  // The type is left bare: `varchar(255)` and `decimal(8,2)` are valid DBML
  // as written, and quoting them would wrap nearly every column for nothing.
  return `${quote(column.name)} ${column.type} [${settings.join(', ')}]`
}

/**
 * dbdiagram.io accepts a double-quoted identifier anywhere a bare one is
 * allowed, so anything that is not plainly bare is quoted rather than guessed
 * at. A name carrying a quote of its own is escaped.
 */
function quote(name: string): string {
  if (BARE.test(name) && !RESERVED.has(name.toLowerCase())) {
    return name
  }

  return `"${name.replace(/"/g, '\\"')}"`
}
