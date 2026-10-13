import type { Parsed } from './parse'

export type Problem = { line: number; severity: 'error' | 'warning'; message: string }

/**
 * What the pane under the editor lists.
 *
 * Thin on purpose. The plan called for deriving a set of schema problems —
 * a reference to a table or column that is not there, a name used twice, a
 * table with no columns — and the parser turns out to reject every one of them
 * itself, with a line number and a better sentence than ours:
 *
 *   Field "id" existed in table "users"
 *   Can't find field "nope" in table "c"
 *
 * Writing our own would have been dead code behind a branch that never runs.
 * The first genuinely derived problem arrives with enums, which nothing in this
 * pass parses yet.
 */
export function problemsOf(parsed: Parsed): Problem[] {
  return parsed.ok ? [] : [{ line: parsed.line, severity: 'error', message: parsed.message }]
}
