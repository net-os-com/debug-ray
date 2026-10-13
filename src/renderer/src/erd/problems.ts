import type { Parsed } from './parse'
import type { ErdModel } from './model'

export type Problem = { line: number; severity: 'error' | 'warning'; message: string }

/**
 * What the pane under the editor lists.
 *
 * The parser rejects a reference to a table or column that is not there, a name
 * used twice, and a table with no columns, each with a line number and a better
 * sentence than ours — so those are reported as it words them rather than
 * re-derived.
 *
 * The warnings are the ones it has no opinion about: a document that parses can
 * still describe a schema that will not behave, and these are the three cases
 * this application actually meets.
 */
export function problemsOf(parsed: Parsed, model: ErdModel): Problem[] {
  if (!parsed.ok) {
    return [{ line: parsed.line, severity: 'error', message: parsed.message }]
  }

  const problems: Problem[] = []
  const declared = new Set(model.enums.map((one) => one.name))

  for (const table of model.tables) {
    if (!table.columns.some((column) => column.primary)) {
      problems.push({
        line: 0,
        severity: 'warning',
        message: `${table.name} has no primary key.`,
      })
    }

    for (const column of table.columns) {
      if (column.defaultValue === null || !declared.has(column.type)) {
        continue
      }

      const values = model.enums.find((one) => one.name === column.type)?.values ?? []

      if (!values.includes(column.defaultValue)) {
        problems.push({
          line: 0,
          severity: 'warning',
          message: `${table.name}.${column.name} defaults to '${column.defaultValue}', which ${column.type} does not allow.`,
        })
      }
    }
  }

  for (const relation of model.relations) {
    if (relation.crossDatabase) {
      problems.push({
        line: 0,
        severity: 'warning',
        message: `${relation.from.table}.${relation.from.column} references ${relation.to.table} in another database; MySQL cannot enforce it.`,
      })
    }
  }

  return problems
}
