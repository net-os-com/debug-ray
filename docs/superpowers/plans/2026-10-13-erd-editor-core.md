# ERD Editor — Core Implementation Plan (A of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the ERD view from a renderer of the live schema into an editor of a committed `schema.dbml`: a DBML source pane beside the canvas, problems by line, and canvas edits that patch only the lines they change.

**Architecture:** The DBML text becomes the state. `@dbml/core` parses it into the existing `ErdModel`, which the canvas already knows how to draw. Canvas edits are surgical patches against the source, located by the exact byte offsets the parser reports on every table and field, re-parsed before and after so a control can never corrupt the file.

**Tech Stack:** Electron 44, React 19, TypeScript 7, electron-vite. One new dependency: `@dbml/core`.

**Spec:** `docs/superpowers/specs/2026-10-13-erd-editor-design.md`

**Builds on:** `feature/erd-view` (the shipped read-and-show pass). Plan B covers enums, notes, table groups, the remaining importers and the sidebar.

## Global Constraints

- **No test suite.** This project has none by standing decision. Every task verifies by running something and reading real output: pure functions through a throwaway probe under the session scratchpad, everything else by driving the running app over CDP. Do not add a test framework or a `tests/` directory.
- **There is no lint script and no eslint config.** The gate is `npm run typecheck` (both projects) plus a successful `npx electron-vite build`. Do not invent a lint step.
- **One new dependency only:** `@dbml/core`. Nothing else enters `package.json`.
- **The ERD never writes to the database or to migrations.** It reads them and writes two files.
- **The text is the record.** No canvas control may leave the source unparseable: every patch re-parses before and after, and a patch that breaks the document is discarded, not saved.
- **Tinker must keep behaving exactly as it does today.** Task 2 refactors a component it depends on.
- American English in code, comments and UI copy. One responsibility per file, dependency injection, comments that say why.

## Review Focus

Five things the spec implies that the happy path will not exercise, most likely to bite first:

1. **A patch applied to stale offsets** — the user types in the editor, then clicks a canvas control whose ranges were computed from the previous parse. The edit must land in the right place or be refused, never silently corrupt a neighbouring line. Pinned in Task 4.
2. **Source that does not parse** — a half-typed `Table users {` means the canvas has no model. The view must keep showing the last good diagram and report the error, not blank out. Pinned in Task 3.
3. **A table renamed in the editor** — the layout file keys on name, so the position is lost and the table jumps to the auto-arrange corner. Pinned in Task 5.
4. **A column whose name or type needs quoting, edited on the canvas** — the patch must re-quote on the way back in, or the file stops parsing on the next keystroke. Pinned in Task 4.
5. **An import over unsaved work** — replacing the editor's contents must not silently discard edits. Pinned in Task 5.

---

## File Structure

**New** (`src/renderer/src/erd/`)
- `parse.ts` — `@dbml/core` output → `ErdModel`, plus the source ranges patches need
- `dbml-tokens.ts` — line tokenizer for the editor's highlighting
- `problems.ts` — parse errors and derived schema problems, by line
- `patch.ts` — surgical replacement of a field, index or table range
- `editor-pane.tsx` — the source pane: editor above, problems below
- `column-editor.tsx` — the per-column form the canvas opens

**Changed**
- `src/renderer/src/tinker/code-editor.tsx` → language-agnostic shell
- `src/renderer/src/tinker/tinker-view.tsx` — passes the PHP tokenizer and completion
- `src/renderer/src/erd/use-erd.ts` — rebuilt around `code`
- `src/renderer/src/erd/erd-view.tsx` — editor pane beside the canvas
- `src/renderer/src/erd/table-card.tsx` — a column opens the editor
- `src/main/erd/store.ts` + the package command — `read` returns the dbml too
- `src/renderer/src/app.css` — the `.erd-editor*` block

**Unchanged and depended upon:** `model.ts`, `arrange.ts`, `erd-canvas.tsx`, `relations-layer.tsx`, `dbml.ts`, `schema-to-model.ts`.

---

### Task 1: Parse DBML into the model the canvas already draws

**Files:**
- Create: `src/renderer/src/erd/parse.ts`
- Modify: `package.json` — add `@dbml/core`

**Interfaces:**
- Consumes: `ErdModel`, `ErdTable`, `ErdColumn`, `ErdRelation` from `./model`
- Produces:
  ```ts
  export type SourceRange = { start: number; end: number }
  export type ParsedTable = { name: string; range: SourceRange; columns: Record<string, SourceRange>; body: SourceRange }
  export type Parsed =
    | { ok: true; model: ErdModel; tables: Record<string, ParsedTable> }
    | { ok: false; line: number; column: number; message: string }
  export function parseDbml(code: string): Parsed
  ```

- [ ] **Step 1: Add the dependency**

```bash
npm install @dbml/core
```

- [ ] **Step 2: Write the parser adapter**

The shapes below were read off the real library, not guessed: a table carries
`token`, `name`, `fields`, `indexes`, `headerColor`; a field carries `token`,
`name`, `type.type_name`, `pk`, `unique`, `not_null`; a ref carries `onDelete`
and two `endpoints` with `tableName`, `fieldNames` and `relation`.

```ts
import { Parser } from '@dbml/core'
import type { ErdColumn, ErdModel, ErdRelation, ErdTable } from './model'

export type SourceRange = { start: number; end: number }

export type ParsedTable = {
  name: string
  /** The whole `Table x { … }` block. */
  range: SourceRange
  /** Each column's own line, keyed by column name. */
  columns: Record<string, SourceRange>
  /** Just inside the braces, where a new column is inserted. */
  body: SourceRange
}

export type Parsed =
  | { ok: true; model: ErdModel; tables: Record<string, ParsedTable> }
  | { ok: false; line: number; column: number; message: string }

/**
 * Turns DBML source into the model the canvas draws, and the byte ranges a
 * patch needs to change one line without touching the rest of the file.
 */
export function parseDbml(code: string): Parsed {
  let database: ReturnType<typeof Parser.parse>

  try {
    database = Parser.parse(code, 'dbml')
  } catch (error) {
    return failure(error)
  }

  const schema = database.schemas[0]

  if (schema === undefined) {
    return { ok: true, model: { tables: [], relations: [] }, tables: {} }
  }

  const tables: Record<string, ParsedTable> = {}
  const modelTables: ErdTable[] = []

  for (const table of schema.tables) {
    const columns: Record<string, SourceRange> = {}

    for (const field of table.fields) {
      columns[field.name] = { start: field.token.start.offset, end: field.token.end.offset }
    }

    const range = { start: table.token.start.offset, end: table.token.end.offset }

    tables[table.name] = {
      name: table.name,
      range,
      columns,
      // The closing brace is the last character of the block, so a new column
      // goes immediately before it.
      body: { start: range.end - 1, end: range.end - 1 },
    }

    const primary = new Set(
      table.indexes.filter((index) => index.pk).flatMap((index) => index.columns.map((c) => c.value)),
    )

    modelTables.push({
      name: table.name,
      database: '',
      columns: table.fields.map(
        (field): ErdColumn => ({
          name: field.name,
          type: field.type.type_name,
          nullable: !field.not_null,
          primary: field.pk === true || primary.has(field.name),
          unique: field.unique === true,
          references: null,
        }),
      ),
      indexes: table.indexes
        .filter((index) => !index.pk)
        .map((index) => ({
          name: index.name ?? '',
          columns: index.columns.map((column) => column.value),
          unique: index.unique === true,
        })),
    })
  }

  return { ok: true, model: { tables: modelTables, relations: relations(schema) }, tables }
}

function relations(schema: { refs: unknown[] }): ErdRelation[] {
  const out: ErdRelation[] = []

  for (const raw of schema.refs) {
    const ref = raw as {
      onDelete?: string | null
      endpoints: { tableName: string; fieldNames: string[]; relation: string }[]
    }
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

/** The parser throws a diagnostic with a location; anything else is reported as-is. */
function failure(error: unknown): Parsed {
  const diagnostic = error as { location?: { start?: { line?: number; column?: number } }; message?: string }
  const start = diagnostic.location?.start

  return {
    ok: false,
    line: typeof start?.line === 'number' ? start.line : 1,
    column: typeof start?.column === 'number' ? start.column : 1,
    message: typeof diagnostic.message === 'string' ? diagnostic.message : String(error),
  }
}
```

- [ ] **Step 3: Write the probe**

In the session scratchpad as `erd2/entry.ts`:

```ts
export { parseDbml } from '/Users/rickbongers/Code/NetOS-ray/src/renderer/src/erd/parse'
```

and `erd2/parse.mjs`:

```js
const { parseDbml } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }

const src = [
  'Table users {',
  '  id bigint [pk, not null]',
  '  email varchar(255) [unique, not null]',
  '',
  '  indexes {',
  '    (email) [unique]',
  '  }',
  '}',
  '',
  'Table bookings {',
  '  id bigint [pk, not null]',
  '  user_id bigint [not null]',
  '}',
  '',
  'Ref: bookings.user_id > users.id [delete: cascade]',
].join('\n')

const ok = parseDbml(src)
check('parst', ok.ok === true)
check('twee tabellen', ok.model.tables.length === 2)
check('relatie met richting', ok.model.relations[0].from.table === 'bookings' && ok.model.relations[0].to.table === 'users')
check('onDelete bewaard', ok.model.relations[0].onDelete === 'cascade')
check('pk gemarkeerd', ok.model.tables[0].columns[0].primary === true)
check('nullable afgeleid van not_null', ok.model.tables[0].columns[0].nullable === false)
check('unique index niet als pk', ok.model.tables[0].indexes.length === 1)

// De ranges moeten precies de kolomregel afbakenen.
const slice = src.slice(ok.tables.users.columns.email.start, ok.tables.users.columns.email.end)
check('kolom-range dekt de regel', slice.includes('email varchar(255)'), JSON.stringify(slice))
check('tabel-range begint bij Table', src.slice(ok.tables.users.range.start).startsWith('Table users'))
check('body-anker staat op de sluitaccolade', src[ok.tables.users.body.start] === '}')

const broken = parseDbml('Table users {\n  id bigint\n')
check('kapotte bron geeft ok:false', broken.ok === false)
check('met een regelnummer', typeof broken.line === 'number' && broken.line >= 1, 'regel ' + broken.line)

const empty = parseDbml('')
check('lege bron is geldig en leeg', empty.ok === true && empty.model.tables.length === 0)

console.log(bad === 0 ? '\nTask 1: alles groen' : `\nTask 1: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 4: Run the probe**

```bash
cd /Users/rickbongers/Code/NetOS-ray
npx esbuild <scratchpad>/erd2/entry.ts --bundle --format=esm --platform=node --outfile=<scratchpad>/erd2/bundle.mjs --log-level=error
node <scratchpad>/erd2/parse.mjs
```

Expected: twelve lines, all `OK`. If "body-anker" fails, the parser's table token does not end on the brace and `body` must be derived by searching backwards from `range.end` for `}`.

- [ ] **Step 5: Typecheck, build, commit**

```bash
npm run typecheck && npx electron-vite build
git add package.json package-lock.json src/renderer/src/erd/parse.ts
git commit -m "feat(erd): parse DBML into the model, with the ranges a patch needs"
```

---

### Task 2: Make the code editor language-agnostic

**Files:**
- Modify: `src/renderer/src/tinker/code-editor.tsx` → move to `src/renderer/src/ui/code-editor.tsx`
- Modify: `src/renderer/src/tinker/tinker-view.tsx` — pass the PHP language in
- Create: `src/renderer/src/erd/dbml-tokens.ts`

**Interfaces:**
- Consumes: the existing `tokenize` from `tinker/php-tokens`, `ClassIndex` from `tinker/rank-classes`
- Produces:
  ```ts
  export type EditorToken = { text: string; color: string; italic: boolean }
  export type Completion = { entries: ClassEntry[]; apply: (code: string, caret: number, entry: ClassEntry) => { code: string; caret: number } }
  export function CodeEditor(props: {
    code: string
    tokenize: (line: string) => EditorToken[]
    completion?: Completion | null
    onChange: (code: string) => void
    onRun?: () => void
  }): JSX.Element
  export function tokenizeDbml(line: string): EditorToken[]
  ```

- [ ] **Step 1: Move the component and take the language as props**

`code-editor.tsx` is 269 lines and already does exactly the right thing; the
change is to stop it importing PHP. Replace the `classes: ClassIndex` prop and
the `tokenize` import with the two props above, and make the completion block
render only when `completion` is given. `onRun` becomes optional — the ERD has
no run key. Everything else, including the ruler measurement and the caret
alignment, stays byte-for-byte.

- [ ] **Step 2: Write the DBML tokenizer**

Same contract as `php-tokens`: one line in, coloured spans out. Deliberately
regex-shallow, for the same reason the PHP one is — it has to survive a line
mid-keystroke, not be a parser.

```ts
import type { EditorToken } from '../ui/code-editor'

const KEYWORDS = /^(Table|Ref|Enum|Indexes|indexes|Note|note|TableGroup|Project|as|pk|unique|increment|not|null|default|delete|update|cascade|restrict)$/

/** Comments, quoted strings, bracketed settings, numbers, then bare words. */
const SPLIT = /(\/\/.*$|'[^']*'|"[^"]*"|`[^`]*`|\b\d+\b|\b[A-Za-z_][\w]*\b)/

export function tokenizeDbml(line: string): EditorToken[] {
  return line
    .split(SPLIT)
    .filter((piece) => piece !== '' && piece !== undefined)
    .map((text) => ({ text, color: colorOf(text), italic: text.startsWith('//') }))
}

function colorOf(text: string): string {
  if (text.startsWith('//')) {
    return 'var(--t3)'
  }

  if (text.startsWith("'") || text.startsWith('"') || text.startsWith('`')) {
    return 'var(--sql-str)'
  }

  if (/^\d+$/.test(text)) {
    return 'var(--sql-num)'
  }

  return KEYWORDS.test(text) ? 'var(--sql-kw)' : 'var(--t1)'
}
```

- [ ] **Step 3: Check Tinker still behaves**

This is the step that matters: Tinker is in daily use and this task edited the
component under it.

```bash
npm run typecheck && npx electron-vite build
RAY_PORT=23600 ./node_modules/.bin/electron --remote-debugging-port=9444 . &
```

Then over CDP: open Tinker, type `$user = new App\`, confirm the completion
popup appears and picking an entry inserts the class; confirm the highlighting
still colours keywords and strings; confirm the line numbers still line up with
the text at the bottom of a 40-line snippet.

Expected: all three as before. A caret that no longer sits on its character
means the ruler measurement moved — compare against `git show HEAD:src/renderer/src/tinker/code-editor.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/ui/code-editor.tsx src/renderer/src/tinker src/renderer/src/erd/dbml-tokens.ts
git commit -m "refactor(editor): take the language as props, and add a DBML tokenizer"
```

---

### Task 3: Problems, and a canvas that survives a broken source

**Files:**
- Create: `src/renderer/src/erd/problems.ts`

**Interfaces:**
- Consumes: `Parsed`, `parseDbml` from `./parse`; `ErdModel` from `./model`
- Produces:
  ```ts
  export type Problem = { line: number; severity: 'error' | 'warning'; message: string }
  export function problemsOf(parsed: Parsed, code: string): Problem[]
  ```

- [ ] **Step 1: Write it**

```ts
import type { Parsed } from './parse'

export type Problem = { line: number; severity: 'error' | 'warning'; message: string }

/**
 * What the pane under the editor lists.
 *
 * A parse error comes with its own line. The rest are things that parse but
 * will not hold: a reference to something that is not there, a name used twice,
 * a table with nothing in it.
 */
export function problemsOf(parsed: Parsed, code: string): Problem[] {
  if (!parsed.ok) {
    return [{ line: parsed.line, severity: 'error', message: parsed.message }]
  }

  const problems: Problem[] = []
  const lineOf = lineFinder(code)
  const columns = new Map(parsed.model.tables.map((table) => [table.name, new Set(table.columns.map((c) => c.name))]))

  for (const table of parsed.model.tables) {
    if (table.columns.length === 0) {
      problems.push({
        line: lineOf(parsed.tables[table.name]?.range.start ?? 0),
        severity: 'warning',
        message: `Table ${table.name} has no columns.`,
      })
    }

    const seen = new Set<string>()

    for (const column of table.columns) {
      if (seen.has(column.name)) {
        problems.push({
          line: lineOf(parsed.tables[table.name]?.columns[column.name]?.start ?? 0),
          severity: 'error',
          message: `${table.name}.${column.name} is defined twice.`,
        })
      }

      seen.add(column.name)
    }
  }

  for (const relation of parsed.model.relations) {
    const target = columns.get(relation.to.table)

    if (target === undefined) {
      problems.push({ line: 1, severity: 'error', message: `No table named ${relation.to.table}.` })
    } else if (!target.has(relation.to.column)) {
      problems.push({
        line: 1,
        severity: 'error',
        message: `${relation.to.table} has no column ${relation.to.column}.`,
      })
    }
  }

  return problems
}

/** Offsets come back from the parser; the pane shows lines. */
function lineFinder(code: string): (offset: number) => number {
  const breaks: number[] = []

  for (let index = 0; index < code.length; index += 1) {
    if (code[index] === '\n') {
      breaks.push(index)
    }
  }

  return (offset) => breaks.filter((at) => at < offset).length + 1
}
```

- [ ] **Step 2: Extend the probe**

Add to `erd2/entry.ts`:

```ts
export { problemsOf } from '/Users/rickbongers/Code/NetOS-ray/src/renderer/src/erd/problems'
```

Add `erd2/problems.mjs`:

```js
const { parseDbml, problemsOf } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }
const of = (src) => problemsOf(parseDbml(src), src)

check('schoon schema geeft niets',
  of('Table users {\n  id bigint [pk]\n}\n').length === 0)

// Review Focus 2: kapotte bron geeft precies 1 fout, met regelnummer.
const broken = of('Table users {\n  id bigint\n')
check('RF2 kapotte bron geeft 1 fout', broken.length === 1 && broken[0].severity === 'error')
check('RF2 met een bruikbaar regelnummer', broken[0].line >= 1, 'regel ' + broken[0].line)

const dupe = of('Table users {\n  id bigint [pk]\n  id bigint\n}\n')
check('dubbele kolom gemeld', dupe.some((p) => p.message.includes('defined twice')))
check('op de regel van de tweede', dupe.find((p) => p.message.includes('twice'))?.line === 3)

const dangling = of('Table a {\n  b bigint\n}\nRef: a.b > ghost.id\n')
check('verwijzing naar onbekende tabel gemeld', dangling.some((p) => p.message.includes('No table named ghost')))

console.log(bad === 0 ? '\nTask 3: alles groen' : `\nTask 3: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 3: Run it**

```bash
npx esbuild <scratchpad>/erd2/entry.ts --bundle --format=esm --platform=node --outfile=<scratchpad>/erd2/bundle.mjs --log-level=error
node <scratchpad>/erd2/problems.mjs
```

Expected: six lines, all `OK`.

- [ ] **Step 4: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd/problems.ts
git commit -m "feat(erd): report parse errors and schema problems by line"
```

---

### Task 4: Surgical patches

**Files:**
- Create: `src/renderer/src/erd/patch.ts`

**Interfaces:**
- Consumes: `parseDbml`, `Parsed`, `SourceRange` from `./parse`; `ErdColumn` from `./model`
- Produces:
  ```ts
  export type PatchResult = { ok: true; code: string } | { ok: false; reason: string }
  export function renameColumn(code: string, table: string, column: string, to: string): PatchResult
  export function retypeColumn(code: string, table: string, column: string, type: string): PatchResult
  export function setColumnFlags(code: string, table: string, column: string, flags: { primary?: boolean; unique?: boolean; nullable?: boolean }): PatchResult
  export function deleteColumn(code: string, table: string, column: string): PatchResult
  export function addColumn(code: string, table: string, column: ErdColumn): PatchResult
  export function setHeaderColor(code: string, table: string, color: string | null): PatchResult
  ```

- [ ] **Step 1: Write the patcher**

Every exported function goes through one path: parse, locate, splice, re-parse.

```ts
import type { ErdColumn } from './model'
import { parseDbml, type SourceRange } from './parse'

export type PatchResult = { ok: true; code: string } | { ok: false; reason: string }

/** Matches `dbml.ts`, so a patched line is spelled the way a generated one is. */
const BARE = /^[A-Za-z_][A-Za-z0-9_]*$/
const BARE_TYPE = /^[A-Za-z_][A-Za-z0-9_]*(\([^()]*\))?$/

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
  locate: (parsed: Extract<ReturnType<typeof parseDbml>, { ok: true }>) => SourceRange | string,
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

function columnRange(
  parsed: Extract<ReturnType<typeof parseDbml>, { ok: true }>,
  table: string,
  column: string,
): SourceRange | string {
  const found = parsed.tables[table]?.columns[column]

  return found ?? `No column ${table}.${column} in the source.`
}

function columnOf(
  parsed: Extract<ReturnType<typeof parseDbml>, { ok: true }>,
  table: string,
  column: string,
): ErdColumn | null {
  return parsed.model.tables.find((one) => one.name === table)?.columns.find((one) => one.name === column) ?? null
}

/** A patched line is spelled exactly as `dbml.ts` would have generated it. */
function columnLine(column: ErdColumn): string {
  const settings = [
    ...(column.primary ? ['pk'] : []),
    ...(column.unique ? ['unique'] : []),
    column.nullable ? 'null' : 'not null',
  ]
  const name = BARE.test(column.name) ? column.name : `"${column.name}"`
  const type = BARE_TYPE.test(column.type) ? column.type : `"${column.type}"`

  return `  ${name} ${type} [${settings.join(', ')}]\n`
}

export function renameColumn(code: string, table: string, column: string, to: string): PatchResult {
  let line = ''

  return patch(
    code,
    (parsed) => {
      const current = columnOf(parsed, table, column)

      if (current === null) {
        return `No column ${table}.${column} in the source.`
      }

      line = columnLine({ ...current, name: to })

      return columnRange(parsed, table, column)
    },
    () => line,
  )
}
```

The remaining five, written out because whoever implements this task may not be
reading Task 4 in order:

```ts
export function retypeColumn(code: string, table: string, column: string, type: string): PatchResult {
  let line = ''

  return patch(
    code,
    (parsed) => {
      const current = columnOf(parsed, table, column)

      if (current === null) {
        return `No column ${table}.${column} in the source.`
      }

      line = columnLine({ ...current, type })

      return columnRange(parsed, table, column)
    },
    () => line,
  )
}

export function setColumnFlags(
  code: string,
  table: string,
  column: string,
  flags: { primary?: boolean; unique?: boolean; nullable?: boolean },
): PatchResult {
  let line = ''

  return patch(
    code,
    (parsed) => {
      const current = columnOf(parsed, table, column)

      if (current === null) {
        return `No column ${table}.${column} in the source.`
      }

      line = columnLine({
        ...current,
        primary: flags.primary ?? current.primary,
        unique: flags.unique ?? current.unique,
        nullable: flags.nullable ?? current.nullable,
      })

      return columnRange(parsed, table, column)
    },
    () => line,
  )
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
 * `[headercolor: #rrggbb]` sits on the Table line. Rather than parse that line
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

      // From `Table` up to the opening brace.
      const open = code.indexOf('{', found.range.start)

      return open < 0 ? `Table ${table} has no body.` : { start: found.range.start, end: open }
    },
    () => {
      const name = BARE.test(table) ? table : `"${table}"`

      return color === null ? `Table ${name} ` : `Table ${name} [headercolor: ${color}] `
    },
  )
}
```

- [ ] **Step 2: Extend the probe**

Add to `erd2/entry.ts`:

```ts
export { renameColumn, retypeColumn, setColumnFlags, deleteColumn, addColumn } from '/Users/rickbongers/Code/NetOS-ray/src/renderer/src/erd/patch'
```

Add `erd2/patch.mjs`:

```js
const { renameColumn, retypeColumn, setColumnFlags, deleteColumn, addColumn, parseDbml } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }

const src = [
  '// kept on purpose',
  'Table users {',
  '  id bigint [pk, not null]',
  '  email varchar(255) [unique, not null]',
  '}',
  '',
  'Table bookings {',
  '  id bigint [pk, not null]',
  '}',
].join('\n') + '\n'

const renamed = renameColumn(src, 'users', 'email', 'email_address')
check('hernoemen slaagt', renamed.ok === true)
check('commentaar blijft staan', renamed.code.includes('// kept on purpose'))
check('andere tabel ongemoeid', renamed.code.includes('Table bookings {\n  id bigint [pk, not null]\n}'))
const changed = src.split('\n').filter((l, i) => l !== renamed.code.split('\n')[i]).length
check('precies 1 regel gewijzigd', changed === 1, changed + ' regels')

// Review Focus 4: een naam die gequote moet worden.
const quoted = renameColumn(src, 'users', 'email', 'e mail')
check('RF4 naam met spatie wordt gequote', quoted.ok === true && quoted.code.includes('"e mail"'))
check('RF4 en het blijft parsen', parseDbml(quoted.code).ok === true)

const retyped = retypeColumn(src, 'users', 'email', 'bigint unsigned')
check('RF4 type met spatie wordt gequote', retyped.ok === true && retyped.code.includes('"bigint unsigned"'))

const flagged = setColumnFlags(src, 'users', 'email', { nullable: true })
check('vlag omzetten', flagged.ok === true && flagged.code.includes('email varchar(255) [unique, null]'))

const dropped = deleteColumn(src, 'users', 'email')
check('kolom verwijderen', dropped.ok === true && !dropped.code.includes('email'))
check('en tabel blijft geldig', parseDbml(dropped.code).ok === true)

const added = addColumn(src, 'bookings', { name: 'user_id', type: 'bigint', nullable: false, primary: false, unique: false, references: null })
check('kolom toevoegen', added.ok === true && added.code.includes('user_id bigint [not null]'))
check('toegevoegd binnen de juiste tabel', parseDbml(added.code).model.tables.find(t => t.name === 'bookings').columns.length === 2)

// Review Focus 1: een patch op een bron die niet parst, wordt geweigerd.
const onBroken = renameColumn('Table users {\n  id bigint\n', 'users', 'id', 'x')
check('RF1 patch op kapotte bron geweigerd', onBroken.ok === false)
const missing = renameColumn(src, 'users', 'ghost', 'x')
check('RF1 patch op onbekende kolom geweigerd', missing.ok === false)

console.log(bad === 0 ? '\nTask 4: alles groen' : `\nTask 4: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 3: Run it**

```bash
npx esbuild <scratchpad>/erd2/entry.ts --bundle --format=esm --platform=node --outfile=<scratchpad>/erd2/bundle.mjs --log-level=error
node <scratchpad>/erd2/patch.mjs
```

Expected: fourteen lines, all `OK`. "precies één regel gewijzigd" is the one
that proves the whole approach — if it reports more, the patch is rewriting
the document instead of splicing it.

- [ ] **Step 4: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd/patch.ts
git commit -m "feat(erd): patch the source one line at a time"
```

---

### Task 5: The source becomes the state

**Files:**
- Modify: `src/renderer/src/erd/use-erd.ts` — rebuilt around `code`
- Modify: `src/main/erd/store.ts` — `readErd` returns `dbml`
- Modify: `src/shared/erd.ts` — `ErdStored` gains `dbml: string`
- Modify: `/Users/rickbongers/Code/laravel-netos-debug/src/Erd/ErdStore.php` and `src/Console/ErdCommand.php` — `read` returns the file's contents

**Interfaces:**
- Consumes: `parseDbml`, `problemsOf`, the patch functions, `arrange`, `toDbml`, `schemaToModel`
- Produces: `useErd(container, tables, tenant)` returning `{ code, setCode, model, problems, layout, view, setView, selected, setSelected, move, rearrange, save, importFromMySql, saving, saved, error, dirty }`

- [ ] **Step 1: Let the package hand back the dbml**

In `ErdStore::read()`, add the file's contents beside the layout:

```php
return [
    'dbml' => is_file($this->schemaFile()) ? (string) file_get_contents($this->schemaFile()) : '',
    'layout' => is_array($decoded['tables'] ?? null) ? $decoded['tables'] : [],
    'savedAt' => is_string($decoded['savedAt'] ?? null) ? $decoded['savedAt'] : null,
];
```

Tag it `v0.2.2` and update the monorepo. Note: the repository already carries
both a `0.2.0` and a `v0.2.0` tag on different commits — use the `v` prefix and
a higher patch, and do not reuse a number.

Mirror it in `src/shared/erd.ts` (`dbml: string`) and in `readErd`'s guard
(`typeof data.dbml === 'string' ? data.dbml : ''`).

- [ ] **Step 2: Rebuild the hook around `code`**

The model stops being state and becomes `useMemo(() => parseDbml(code), [code])`.
`importFromMySql` runs the existing `schemaToModel` + `toDbml` and sets `code`.
`dirty` is `code !== lastSaved`. The arrange effect keys on the parsed model's
table names rather than on a model object, so typing a comment does not
re-arrange the diagram.

The last good model is kept, so a source that does not parse mid-keystroke
leaves the canvas showing what it last drew instead of blanking:

```ts
const parsed = useMemo(() => parseDbml(code), [code])
const lastGood = useRef<ErdModel>({ tables: [], relations: [] })

if (parsed.ok) {
  lastGood.current = parsed.model
}

const model = parsed.ok ? parsed.model : lastGood.current
```

- [ ] **Step 3: Carry a position across a rename**

A table renamed in the editor is a new name to the layout, so its position is
lost. Compare the previous parse to the current one: exactly one name gone and
exactly one new, with the same column count, is a rename, and the position
moves with it.

```ts
/**
 * The layout keys on table name, so a rename would drop the card back into the
 * auto-arrange corner. One name out, one name in, same shape: treat it as the
 * same table and carry the position.
 */
function carryRenames(previous: string[], current: string[], layout: Layout): Layout {
  const gone = previous.filter((name) => !current.includes(name))
  const added = current.filter((name) => !previous.includes(name))

  if (gone.length !== 1 || added.length !== 1) {
    return layout
  }

  const from = gone[0]
  const to = added[0]
  const position = layout[from]

  if (position === undefined) {
    return layout
  }

  const next = { ...layout, [to]: position }
  delete next[from]

  return next
}
```

- [ ] **Step 4: Verify in the running app**

```bash
npm run typecheck && npx electron-vite build
RAY_PORT=23600 ./node_modules/.bin/electron --remote-debugging-port=9444 . &
```

Over CDP, with a container picked:

1. Open ERD. Expected: the committed `schema.dbml` loads into the editor and the canvas draws it — no import needed.
2. Type a stray `{` at the end. Expected: the problems pane shows one error with a line number, **and the canvas still shows the previous diagram** (Review Focus 2).
3. Undo it. Expected: the problem clears.
4. Rename a table in the editor. Expected: its card keeps its position (Review Focus 3).
5. Press Save, then check `git diff laravel/server/database/schema.dbml` in the monorepo. Expected: only the lines you touched.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/erd/use-erd.ts src/main/erd/store.ts src/shared/erd.ts
git commit -m "feat(erd): the DBML source becomes the state"
```

---

### Task 6: The editor pane and the column editor

**Files:**
- Create: `src/renderer/src/erd/editor-pane.tsx`
- Create: `src/renderer/src/erd/column-editor.tsx`
- Modify: `src/renderer/src/erd/erd-view.tsx`, `table-card.tsx`, `src/renderer/src/app.css`

**Interfaces:**
- Consumes: `CodeEditor` and `EditorToken` from `../ui/code-editor`, `tokenizeDbml`, `Problem`, the patch functions, `ErdState`

- [ ] **Step 1: The editor pane**

```tsx
import { CodeEditor } from '../ui/code-editor'
import { tokenizeDbml } from './dbml-tokens'
import type { Problem } from './problems'

type EditorPaneProps = {
  code: string
  problems: Problem[]
  onChange: (code: string) => void
}

export function EditorPane({ code, problems, onChange }: EditorPaneProps) {
  return (
    <div className="erd-editor">
      <div className="erd-editor__code">
        <CodeEditor code={code} onChange={onChange} tokenize={tokenizeDbml} />
      </div>
      <div className="erd-editor__problems">
        {problems.length === 0 ? (
          <div className="erd-editor__clean">No problems</div>
        ) : (
          problems.map((problem, index) => (
            <div className="erd-editor__problem" key={`${problem.line}-${index}`}>
              <span
                className={
                  problem.severity === 'error'
                    ? 'erd-editor__line erd-editor__line--error'
                    : 'erd-editor__line'
                }
              >
                {problem.line}
              </span>
              <span>{problem.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

`.erd-editor__problems` is `max-height: 132px; overflow: auto`, matching the
design. The pane is collapsible from the toolbar; store that flag in the
existing settings so it survives a restart, next to the other ERD preferences.

- [ ] **Step 2: The column editor**

```tsx
import { useState } from 'react'
import type { ErdColumn } from './model'
import { deleteColumn, renameColumn, retypeColumn, setColumnFlags } from './patch'

type ColumnEditorProps = {
  code: string
  table: string
  column: ErdColumn
  onCode: (code: string) => void
  onClose: () => void
}

export function ColumnEditor({ code, table, column, onCode, onClose }: ColumnEditorProps) {
  const [refused, setRefused] = useState<string | null>(null)

  /** Every control goes through here, so a refusal is reported in one place. */
  const apply = (result: ReturnType<typeof renameColumn>): void => {
    if (result.ok) {
      setRefused(null)
      onCode(result.code)

      return
    }

    // The text is the record: a refused patch leaves the field as it was.
    setRefused(result.reason)
  }

  return (
    <div className="erd-colform">
      <label className="erd-colform__field">
        Name
        <input
          className="input input--text"
          defaultValue={column.name}
          onBlur={(event) =>
            event.target.value !== column.name &&
            apply(renameColumn(code, table, column.name, event.target.value))
          }
          type="text"
        />
      </label>

      <label className="erd-colform__field">
        Type
        <input
          className="input input--text"
          defaultValue={column.type}
          onBlur={(event) =>
            event.target.value !== column.type &&
            apply(retypeColumn(code, table, column.name, event.target.value))
          }
          type="text"
        />
      </label>

      <div className="erd-colform__flags">
        {(['primary', 'unique', 'nullable'] as const).map((flag) => (
          <button
            className={column[flag] ? 'chip chip--on' : 'chip'}
            key={flag}
            onClick={() => apply(setColumnFlags(code, table, column.name, { [flag]: !column[flag] }))}
            type="button"
          >
            {flag === 'primary' ? 'pk' : flag === 'unique' ? 'unique' : 'null'}
          </button>
        ))}
      </div>

      {refused === null ? null : <div className="erd-colform__refused">{refused}</div>}

      <div className="erd-colform__actions">
        <button
          className="button"
          onClick={() => {
            apply(deleteColumn(code, table, column.name))
            onClose()
          }}
          type="button"
        >
          Delete column
        </button>
        <button className="button button--primary" onClick={onClose} type="button">
          Done
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in the running app**

Over CDP:

1. Click a column, rename it, press Done. Expected: the editor's text changes on exactly that line, and the card relabels.
2. Set a column to `null`. Expected: `[not null]` becomes `[null]` and nothing else moves.
3. Give a column a name with a space. Expected: it comes back quoted and the problems pane stays empty (Review Focus 4).
4. Break the source in the editor, then click a column. Expected: the form refuses with a readable reason rather than writing (Review Focus 1).
5. Press Import from MySQL with unsaved edits. Expected: it asks first (Review Focus 5).

- [ ] **Step 4: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd src/renderer/src/app.css
git commit -m "feat(erd): edit the source beside the canvas, and on the cards"
```

---

## Done when

- Opening ERD loads the committed `schema.dbml` and draws it, with no import.
- A broken source shows a problem by line and keeps the last good diagram.
- Editing a column on a card changes exactly that line in the file.
- `git diff schema.dbml` after a column rename is three lines.
- Tinker's editor behaves as it did before Task 2.
- `npm run typecheck` is silent and `npx electron-vite build` succeeds.
