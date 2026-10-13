# ERD editor — design

Everything the design canvas shows that the first pass left out: a DBML editor
beside the canvas, editing on the cards themselves, enums, notes, table groups,
problem reporting, and the two remaining import sources.

Design canvas: `NetOS Debug ERD.dc.html`.
Builds on: `2026-10-13-erd-view-design.md` (shipped on `feature/erd-view`).

## Intent

The first pass reads a database and draws it. The design is an editor: you keep
a `schema.dbml` in the repository, work on it, and the diagram is how you read
it. Importing is how you start, not what the view is.

Success means: open the committed `schema.dbml`, change a column on the card,
and get a three-line diff — not a rewritten file.

## This inverts the first pass

The shipped data flow is one-way:

```
useSchema -> ErdModel -> canvas
                      -> toDbml -> schema.dbml        (output only)
```

The design's is source-first, which is how dbdiagram works and why the canvas
keeps `code` and `editorOpen` in its state and reports problems by line number:

```
schema.dbml ──┐
import     ───┤──> code (the state) ──parse──> ErdModel ──> canvas
              │          ▲                                    │
              └──────────┴───────── surgical patch ◄───────────┘
```

So the model stops being the thing we hold and becomes a derived view of the
text. That is a rework of `use-erd`, not an addition to it.

### What survives

- `dbml.ts`, `schema-to-model.ts` — together they become the MySQL *importer*:
  read the schema, emit DBML source. They stop feeding the canvas directly.
- `arrange.ts`, `erd-canvas.tsx`, `table-card.tsx`, `relations-layer.tsx`,
  `model.ts` — unchanged. The canvas does not care where the model came from.
- `main/erd/store.ts` and the `netos-debug:erd` command — unchanged, except that
  `read` now returns the `.dbml` as well as the layout.
- `use-erd.ts` — rebuilt around `code`.

### Decisions taken

| Decision | Choice |
|---|---|
| Source of truth | The DBML text. The model is parsed from it |
| Write-back | Surgical: only the lines that change |
| Parser | `@dbml/core`, taken now |
| Canvas editing | Yes — columns, types, references, indexes, header colour |

## `@dbml/core` comes in

The first pass deliberately deferred it, on the grounds that nothing parsed.
That is no longer true, and the debt is called in.

It earns its place beyond parsing: every table and every field carries a
`token` with exact source offsets.

```
field.token = { start: { offset: 31, line: 3, column: 1 },
                end:   { offset: 52, line: 4, column: 1 } }
```

That is what makes surgical editing tractable rather than a guess — a column
rename is a replacement of one known byte range.

`headerColor` is also a first-class DBML property, which is what the design's
"Header color" control writes.

## Surgical write-back

Every canvas edit becomes a patch against the source:

1. Parse the current `code`. Reject the edit if it does not parse — a canvas
   control must never be the thing that corrupts the file.
2. Find the `token` range of the field, index, or table being changed.
3. Replace exactly that range with the rendered line.
4. Re-parse the result. If the patch broke it, discard it and report, rather
   than leave the editor holding something that will not open.

Rule: the text is the record. A patch that round-trips to a different model than
intended is a bug in the patcher, not something the canvas papers over.

Adding is the one case with no existing range to replace: a new column is
inserted before the closing brace of its table's token, a new table is appended
after the last one.

## The editor

`src/renderer/src/tinker/code-editor.tsx` already is a textarea with a
highlighted copy painted underneath, caret-aligned, with a completion popup.
Its shell is exactly right; it is bound to PHP only through `php-tokens` and
`rank-classes`.

Split it into the shell and the language: a `tokenize` function and a
completion source become props. Tinker keeps its PHP pair, the ERD passes a
DBML pair. That is a refactor of a working component, so it is a task of its
own and the Tinker view has to keep behaving exactly as it does now.

## Problems

Under the editor, a list of `{ line, severity, message }`, with "No problems"
when it is empty. Two sources:

- **Parse errors** from `@dbml/core`, which reports line and column.
- **Schema problems** we derive: a reference to a table or column that does not
  exist, a duplicate table or column name, a table with no columns, an enum
  that nothing uses.

A problem names a line so clicking it can put the caret there.

## Enums, notes and groups

All three are DBML constructs, so they live in the source like everything else.

- **Enums** — `Enum name { a b c }`. Listed in the sidebar with their value
  count; a column of that type links to it.
- **Notes** — `Note` blocks, shown as sticky blocks on the canvas at positions
  kept in `schema.layout.json` beside the tables.
- **Table groups** — `TableGroup name { ... }`, drawn as a labelled rectangle
  behind the cards it contains.

## Importers

- **From MySQL** — shipped; rewired to emit source rather than a model.
- **From migrations** — reads the repository's migration files instead of a
  running database, so it works with no container and shows what the repository
  says rather than what happens to be migrated. It runs in the package, which
  already knows where the project keeps things.
- **The NetOS example** — a short built-in document, for an empty project.

An import replaces the editor's contents, and asks first when there is
unsaved work.

## Sidebar

Search across table and column names, and a scope filter that narrows the
canvas to one table group or one database. Both act on the parsed model, not
on the text.

## Risks

**The refactor of `CodeEditor` touches working code.** Tinker is in daily use.
The split has to be behaviour-preserving, and that is checked by using Tinker,
not by reading the diff.

**Surgical patching is where the bugs will be.** Ranges go stale the moment the
text changes, so every patch re-parses before and after. The failure mode to
avoid is a patch that silently lands in the wrong place.

**Layout and source can drift.** A table renamed in the editor is a new name to
the layout file, and its position is lost. Renames detected through the parse
should carry the position across.

## Out of scope

- Writing migrations, or any write to the database. Still read-only in that
  direction.
- Collaborative editing, history beyond the editor's own undo.
- Rendering DBML features the canvas has no place for yet: `Project`, `checks`,
  `partials`, records.
