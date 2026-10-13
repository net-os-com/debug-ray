# ERD Editor — Features Implementation Plan (B of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything the design canvas shows that Plan A left out — enums, table notes, table groups, sticky notes, importing from migrations, the built-in example, and a sidebar that searches and narrows the diagram.

**Architecture:** Plan A made the DBML text the state and the model a parse of it. Everything here follows that: enums, notes and groups are read out of the same parse and drawn from the same model. The one exception is sticky notes, which this DBML version cannot express, so they live beside the layout. Importing from migrations runs them into a throwaway database and reads it with the introspection that already exists, rather than reading PHP.

**Tech Stack:** Electron 44, React 19, TypeScript 7, `@dbml/core` 10.3. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-erd-editor-design.md`

**Builds on:** Plan A, shipped on `feature/erd-view` (commits `482bbf0..1c16ba5`).

## Global Constraints

- **No test suite**, by standing decision. Every task verifies by running something: pure functions through a throwaway probe under the session scratchpad, everything else by driving the running app over CDP.
- **There is no lint script.** The gate is `npm run typecheck` plus a successful `npx electron-vite build`.
- **No new dependencies.**
- **The ERD never writes to the database or to migrations.** Task 5 migrates into a throwaway database and drops it; it never touches a database the application uses.
- **The text is the record.** Anything expressible in DBML lives in the DBML. Only what the format cannot hold goes in `schema.layout.json`.
- American English in code, comments and UI copy. One responsibility per file, dependency injection, comments that say why.

## What the parser actually gives us

Measured against `@dbml/core` 10.3.1, not assumed:

```
schema.enums[]       -> { name, values: [{ name }], token }
schema.tableGroups[] -> { name, tables: [{ name }], token }
table.note           -> string          table.noteToken -> token
```

A column typed as an enum is indistinguishable from any other column — its
`type.type_name` is just the enum's name — so the link is ours to make.

**A standalone `Note name { '…' }` block does not parse in this version.** The
design's sticky notes therefore cannot live in the `.dbml`; Task 4 puts them
beside the layout and says why.

## Review Focus

Five things the spec implies that the happy path will not exercise:

1. **A column typed as an enum that does not exist** — a plain type and a dangling enum reference look identical, so the card must not claim a link it cannot follow. Pinned in Task 2.
2. **A table group naming a table that is not there, or a table in two groups** — the rectangle has to be drawn from the tables actually present, or it is drawn around nothing. Pinned in Task 3.
3. **A sticky note left behind by a deleted table, and a layout file from before stickies existed** — neither may break the canvas or be silently dropped on save. Pinned in Task 4.
4. **Migrations that fail halfway** — the throwaway database must be dropped and the editor left untouched, not half-filled. Pinned in Task 5.
5. **A search that matches nothing, and a scope with one table in it** — the canvas must say so rather than going blank and looking broken. Pinned in Task 6.

---

## File Structure

**New** (`src/renderer/src/erd/`)
- `enums.ts` — enum lookup built from the model, and which columns use one
- `groups.ts` — the rectangle behind a table group
- `stickies.ts` — sticky notes: the shape, and reading them out of the layout
- `sticky-note.tsx` — one sticky on the canvas
- `erd-sidebar.tsx` — search, scope, the enum list and the note list
- `example.ts` — the built-in NetOS example document

**Changed**
- `model.ts` — gains `enums`, `groups`, and `note` on a table
- `parse.ts` — reads all three out of the schema
- `erd-canvas.tsx` — draws groups behind the cards, stickies among them
- `table-card.tsx` — shows a note marker and links an enum column
- `erd-view.tsx` — the sidebar, and the scope filter
- `use-erd.ts` — sticky state, search and scope
- `main/erd/store.ts`, `shared/erd.ts`, and the package's `ErdStore` — stickies travel with the layout
- `main/erd/migrations.ts` (new) + one parameter on `main/tools/schema.ts` — importing from migrations

---

### Task 1: Read enums, notes and groups out of the parse

**Files:**
- Modify: `src/renderer/src/erd/model.ts`
- Modify: `src/renderer/src/erd/parse.ts`

**Interfaces:**
- Produces, added to `ErdModel`:
  ```ts
  export type ErdEnum = { name: string; values: string[] }
  export type ErdGroup = { name: string; tables: string[] }
  // ErdModel gains: enums: ErdEnum[]; groups: ErdGroup[]
  // ErdTable gains:  note: string | null
  ```

- [ ] **Step 1: Extend the model**

In `model.ts`, beside the existing types:

```ts
export type ErdEnum = { name: string; values: string[] }

export type ErdGroup = { name: string; tables: string[] }
```

Add `note: string | null` to `ErdTable`, and `enums: ErdEnum[]` plus
`groups: ErdGroup[]` to `ErdModel`.

- [ ] **Step 2: Read them in the parser**

In `parse.ts`, extend the raw types and the returned model. The shapes below
were measured, not guessed:

```ts
type RawEnum = { name: string; values: { name: string }[] }
type RawGroup = { name: string; tables: { name: string }[] }
```

Add to `RawTable`: `note?: string | null`. Add to `RawSchema`:
`enums: RawEnum[]`, `tableGroups?: RawGroup[]`.

In the table loop, carry the note:

```ts
      note: typeof table.note === 'string' && table.note !== '' ? table.note : null,
```

And in the returned model:

```ts
  return {
    ok: true,
    model: {
      tables: modelTables,
      relations: relations(schema),
      enums: schema.enums.map((one) => ({
        name: one.name,
        values: one.values.map((value) => value.name),
      })),
      // tableGroups is absent on a schema that declares none.
      groups: (schema.tableGroups ?? []).map((one) => ({
        name: one.name,
        tables: one.tables.map((table) => table.name),
      })),
    },
    tables,
  }
```

Every other construction of an `ErdModel` needs the two new fields: the empty
one at the top of `parseDbml`, `EMPTY` in `use-erd.ts`, and `schemaToModel` in
`schema-to-model.ts` (which has no enums or groups to offer, so both are `[]`
and every table's `note` is `null`).

- [ ] **Step 3: Extend the probe**

Add to the scratchpad's `entry.ts` nothing new — `parseDbml` is already
exported. Add `erd3/model.mjs`:

```js
const { parseDbml } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }

const src = [
  'Enum rol {', '  admin', '  member', '}', '',
  'Table users {', '  id bigint [pk]', '  rol rol', "  Note: 'de gebruikers'", '}', '',
  'Table teams {', '  id bigint [pk]', '}', '',
  'TableGroup kern {', '  users', '  teams', '}', '',
].join('\n')

const ok = parseDbml(src)
check('parst', ok.ok === true, ok.ok ? '' : ok.message)
check('enum gelezen', ok.model.enums[0]?.name === 'rol')
check('met zijn waarden', ok.model.enums[0]?.values.join(',') === 'admin,member')
check('tabelnotitie gelezen', ok.model.tables[0]?.note === 'de gebruikers')
check('tabel zonder notitie is null', ok.model.tables[1]?.note === null)
check('groep gelezen', ok.model.groups[0]?.name === 'kern')
check('met zijn tabellen', ok.model.groups[0]?.tables.join(',') === 'users,teams')

const kaal = parseDbml('Table t {\n  id int [pk]\n}\n')
check('geen enums geeft een lege lijst', Array.isArray(kaal.model.enums) && kaal.model.enums.length === 0)
check('geen groepen geeft een lege lijst', Array.isArray(kaal.model.groups) && kaal.model.groups.length === 0)

console.log(bad === 0 ? '\nTask 1: alles groen' : `\nTask 1: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 4: Run it**

```bash
cd /Users/rickbongers/Code/NetOS-ray
npx esbuild <scratchpad>/erd3/entry.ts --bundle --format=esm --platform=node --outfile=<scratchpad>/erd3/bundle.mjs --log-level=error
node <scratchpad>/erd3/model.mjs
```

Expected: nine lines, all `OK`. If "geen groepen" fails with a crash rather
than a red line, `tableGroups` is absent rather than empty and the `?? []` is
missing.

- [ ] **Step 5: Typecheck, build, commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd/model.ts src/renderer/src/erd/parse.ts src/renderer/src/erd/schema-to-model.ts src/renderer/src/erd/use-erd.ts
git commit -m "feat(erd): read enums, table notes and groups out of the source"
```

---

### Task 2: Enums on the cards and in the sidebar's list

**Files:**
- Create: `src/renderer/src/erd/enums.ts`
- Modify: `src/renderer/src/erd/table-card.tsx`

**Interfaces:**
- Consumes: `ErdEnum`, `ErdModel` from `./model`
- Produces:
  ```ts
  export type EnumUse = { enum: ErdEnum; columns: { table: string; column: string }[] }
  export function enumUses(model: ErdModel): EnumUse[]
  export function enumFor(enums: ErdEnum[], type: string): ErdEnum | null
  ```

- [ ] **Step 1: Write the lookup**

```ts
import type { ErdEnum, ErdModel } from './model'

export type EnumUse = { enum: ErdEnum; columns: { table: string; column: string }[] }

/**
 * The enum a column's type names, or null.
 *
 * A column typed as an enum is spelled exactly like any other column — the
 * parser reports `varchar(255)` and `rol` the same way — so the only thing that
 * makes it an enum reference is a declaration with that name. A type that looks
 * like one but has no declaration is just a type, and must not be shown as a
 * link to something that is not there.
 */
export function enumFor(enums: ErdEnum[], type: string): ErdEnum | null {
  return model.enums.find((one) => one.name === type) ?? null
}

/** Every enum with the columns that use it, for the sidebar's list. */
export function enumUses(model: ErdModel): EnumUse[] {
  return model.enums.map((one) => ({
    enum: one,
    columns: model.tables.flatMap((table) =>
      table.columns
        .filter((column) => enumFor(model.enums, column.type)?.name === one.name)
        .map((column) => ({ table: table.name, column: column.name })),
    ),
  }))
}
```

- [ ] **Step 2: Show it on the card**

`TableCard` gains `enums: ErdEnum[]` (passed down from the canvas, which has the
model) and a note marker. In the column row, when `enumFor` finds a match, the
type is rendered as `erd-card__type erd-card__type--enum` with a `title` listing
the values; otherwise unchanged. In the card header, when `table.note !== null`,
render `<span className="erd-card__note" title={table.note}>note</span>`.

```tsx
          {(() => {
            const declared = enumFor(enums, column.type)

            return (
              <span
                className={declared === null ? 'erd-card__type' : 'erd-card__type erd-card__type--enum'}
                title={declared === null ? undefined : declared.values.join(', ')}
              >
                {column.type}
              </span>
            )
          })()}
```

- [ ] **Step 3: Style it**

In `app.css`, beside the other `.erd-card__*` rules:

```css
/* An enum column links to a declaration; a plain type does not. */
.erd-card__type--enum {
  color: var(--app-accent-fg);
  cursor: help;
}

.erd-card__note {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--t3);
}
```

- [ ] **Step 4: Probe the lookup**

Add `erd3/enums.mjs`:

```js
const { enumFor, enumUses } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }
const col = (name, type) => ({ name, type, nullable: true, primary: false, unique: false, references: null })
const model = {
  tables: [
    { name: 'users', database: '', note: null, indexes: [], columns: [col('rol', 'rol'), col('naam', 'varchar(255)')] },
    { name: 'leden', database: '', note: null, indexes: [], columns: [col('rol', 'rol')] },
  ],
  relations: [],
  enums: [{ name: 'rol', values: ['admin', 'member'] }],
  groups: [],
}

check('enum gevonden op typenaam', enumFor(model.enums, 'rol')?.values.length === 2)
// Review Focus 1: een type dat op een enum lijkt maar niet bestaat.
check('RF1 onbekend type geeft null', enumFor(model.enums, 'status') === null)
check('RF1 gewoon type geeft null', enumFor(model.enums, 'varchar(255)') === null)
check('gebruik over twee tabellen geteld', enumUses(model)[0].columns.length === 2)
check('zonder enums geen gebruik', enumUses({ ...model, enums: [] }).length === 0)

console.log(bad === 0 ? '\nTask 2: alles groen' : `\nTask 2: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 5: Verify in the app**

Build, launch with `RAY_PORT=23600 ./node_modules/.bin/electron --remote-debugging-port=9444 .`, open ERD, and type an enum plus a column that uses it into the editor. Expected: that column's type is coloured and its tooltip lists the values; a column typed `varchar(255)` is not.

- [ ] **Step 6: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd/enums.ts src/renderer/src/erd/table-card.tsx src/renderer/src/erd/erd-canvas.tsx src/renderer/src/app.css
git commit -m "feat(erd): show which columns are enums, and what they allow"
```

---

### Task 3: Table groups behind the cards

**Files:**
- Create: `src/renderer/src/erd/groups.ts`
- Modify: `src/renderer/src/erd/erd-canvas.tsx`, `src/renderer/src/app.css`

**Interfaces:**
- Consumes: `ErdGroup`, `ErdModel` from `./model`; `Layout`, `Point` from `./arrange`; `CARD_WIDTH`, `cardHeight` from `./model`
- Produces:
  ```ts
  export type GroupRect = { name: string; x: number; y: number; width: number; height: number }
  export function groupRects(model: ErdModel, layout: Layout): GroupRect[]
  ```

- [ ] **Step 1: Write it**

```ts
import type { Layout } from './arrange'
import { CARD_WIDTH, cardHeight, type ErdModel } from './model'

export type GroupRect = { name: string; x: number; y: number; width: number; height: number }

/** Breathing room so the label and the border clear the cards. */
const PADDING = 20
const LABEL = 24

/**
 * One rectangle per group, around the cards it actually contains.
 *
 * Built from the tables present rather than from the names the group lists: a
 * group may name a table that was deleted from the source, and drawing a
 * rectangle around nothing is worse than drawing none. A table named by two
 * groups simply falls inside both.
 */
export function groupRects(model: ErdModel, layout: Layout): GroupRect[] {
  const rects: GroupRect[] = []

  for (const group of model.groups) {
    const boxes = group.tables
      .map((name) => {
        const table = model.tables.find((one) => one.name === name)
        const at = layout[name]

        return table === undefined || at === undefined ? null : { at, height: cardHeight(table) }
      })
      .filter((box): box is { at: { x: number; y: number }; height: number } => box !== null)

    if (boxes.length === 0) {
      continue
    }

    const left = Math.min(...boxes.map((box) => box.at.x)) - PADDING
    const top = Math.min(...boxes.map((box) => box.at.y)) - PADDING - LABEL
    const right = Math.max(...boxes.map((box) => box.at.x)) + CARD_WIDTH + PADDING
    const bottom = Math.max(...boxes.map((box) => box.at.y + box.height)) + PADDING

    rects.push({ name: group.name, x: left, y: top, width: right - left, height: bottom - top })
  }

  return rects
}
```

- [ ] **Step 2: Draw them**

In `ErdCanvas`, inside `.erd-layer` and **before** `RelationsLayer`, so a group
sits behind both the lines and the cards:

```tsx
        {groupRects(model, layout).map((rect) => (
          <div
            className="erd-group"
            key={rect.name}
            style={{
              transform: `translate(${rect.x}px, ${rect.y}px)`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          >
            <span className="erd-group__name">{rect.name}</span>
          </div>
        ))}
```

- [ ] **Step 3: Style them**

```css
/* Behind the cards and the lines, and never in the way of a click. */
.erd-group {
  position: absolute;
  left: 0;
  top: 0;
  border: 1px dashed var(--app-border);
  border-radius: var(--radius-xl);
  background: var(--app-surface-2);
  opacity: 0.6;
  pointer-events: none;
}

.erd-group__name {
  position: absolute;
  left: 12px;
  top: 6px;
  font-family: var(--font-display);
  font-size: 11.5px;
  color: var(--t3);
}
```

- [ ] **Step 4: Probe it**

Add `erd3/groups.mjs`:

```js
const { groupRects } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }
const t = (name, n = 2) => ({ name, database: '', note: null, indexes: [], columns: Array.from({ length: n }, (_, i) => ({ name: 'c' + i, type: 'int', nullable: true, primary: false, unique: false, references: null })) })
const model = (groups) => ({ tables: [t('a'), t('b')], relations: [], enums: [], groups })
const layout = { a: { x: 0, y: 0 }, b: { x: 400, y: 200 } }

const one = groupRects(model([{ name: 'kern', tables: ['a', 'b'] }]), layout)
check('precies 1 rechthoek', one.length === 1)
check('omvat beide kaarten', one[0].x < 0 && one[0].width > 640, JSON.stringify(one[0]))

// Review Focus 2: een groep die een tabel noemt die er niet is.
const half = groupRects(model([{ name: 'kern', tables: ['a', 'weg'] }]), layout)
check('RF2 onbekende tabel genegeerd', half.length === 1 && half[0].width < 400, JSON.stringify(half[0]))
const leeg = groupRects(model([{ name: 'spook', tables: ['weg'] }]), layout)
check('RF2 groep zonder aanwezige tabellen wordt niet getekend', leeg.length === 0)

// Review Focus 2: een tabel in twee groepen valt in allebei.
const twee = groupRects(model([{ name: 'x', tables: ['a'] }, { name: 'y', tables: ['a'] }]), layout)
check('RF2 tabel in twee groepen', twee.length === 2)

const zonderPositie = groupRects(model([{ name: 'kern', tables: ['a', 'b'] }]), { a: { x: 0, y: 0 } })
check('tabel zonder positie telt niet mee', zonderPositie[0].width < 400)

console.log(bad === 0 ? '\nTask 3: alles groen' : `\nTask 3: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 5: Verify in the app**

Add a `TableGroup` to the editor naming two tables that are far apart. Expected:
a dashed rectangle appears behind both, labelled, and clicking inside it still
selects the card under the pointer rather than the rectangle.

- [ ] **Step 6: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd/groups.ts src/renderer/src/erd/erd-canvas.tsx src/renderer/src/app.css
git commit -m "feat(erd): draw a table group around the cards it holds"
```

---

### Task 4: Sticky notes

**Files:**
- Create: `src/renderer/src/erd/stickies.ts`, `src/renderer/src/erd/sticky-note.tsx`
- Modify: `src/shared/erd.ts`, `src/main/erd/store.ts`, `src/renderer/src/erd/use-erd.ts`, `erd-canvas.tsx`, `app.css`
- Modify: `/Users/rickbongers/Code/laravel-netos-debug/src/Erd/ErdStore.php`

**Interfaces:**
- Produces:
  ```ts
  export type Sticky = { id: string; text: string; x: number; y: number }
  export function readStickies(raw: unknown): Sticky[]
  ```

- [ ] **Step 1: Decide where they live, in a comment**

`stickies.ts`:

```ts
/**
 * Free notes on the canvas.
 *
 * These are the one thing in the design that cannot live in the DBML: a
 * standalone `Note name { '…' }` block does not parse in @dbml/core 10.3 —
 * verified — and a table's own `Note:` is attached to that table, not to a spot
 * on the canvas. So they go beside the layout, which is already the file for
 * things the format has no room for.
 *
 * That means they are not portable to dbdiagram.io. The alternative was putting
 * them in the .dbml as comments, which would make them invisible to the parser
 * and therefore unreadable back.
 */
export type Sticky = { id: string; text: string; x: number; y: number }

/** Tolerant on purpose: a layout file written before stickies existed has none. */
export function readStickies(raw: unknown): Sticky[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((one): Sticky[] => {
    if (typeof one !== 'object' || one === null) {
      return []
    }

    const value = one as Partial<Sticky>

    return typeof value.id === 'string' &&
      typeof value.text === 'string' &&
      typeof value.x === 'number' &&
      typeof value.y === 'number'
      ? [{ id: value.id, text: value.text, x: value.x, y: value.y }]
      : []
  })
}
```

- [ ] **Step 2: Carry them through the store**

`ErdStored` gains `stickies: Sticky[]`; `saveErd` takes them as a fourth
argument. In `ErdStore.php`, `save()` takes `$stickies` and writes
`['tables' => $layout, 'stickies' => $stickies, 'savedAt' => …]`; `read()`
returns `'stickies' => is_array($decoded['stickies'] ?? null) ? $decoded['stickies'] : []`.
Tag the package `v0.2.3` — note that the repository already carries both a
`0.2.0` and a `v0.2.0` tag on different commits, so use the `v` prefix and a
higher patch, never a number already in use.

In `main/erd/store.ts`, guard it the way the others are guarded:
`stickies: Array.isArray(data.stickies) ? data.stickies : []`.

- [ ] **Step 3: Draw and edit one**

`sticky-note.tsx` is a positioned `div` with a `textarea`, dragged by its
header exactly as `TableCard` is — the same window-bound pointer listeners,
and the same division by `zoom`:

```tsx
import type { Point } from './arrange'
import type { Sticky } from './stickies'

type StickyNoteProps = {
  sticky: Sticky
  zoom: number
  onMove: (at: Point) => void
  onText: (text: string) => void
  onRemove: () => void
}

export function StickyNote({ sticky, zoom, onMove, onText, onRemove }: StickyNoteProps) {
  return (
    <div
      className="erd-sticky"
      style={{ transform: `translate(${sticky.x}px, ${sticky.y}px)` }}
    >
      <div
        className="erd-sticky__grip"
        onPointerDown={(event) => {
          event.stopPropagation()

          const start = { x: event.clientX, y: event.clientY }
          const origin = { x: sticky.x, y: sticky.y }
          const move = (moved: PointerEvent): void =>
            onMove({
              x: origin.x + (moved.clientX - start.x) / zoom,
              y: origin.y + (moved.clientY - start.y) / zoom,
            })
          const up = (): void => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }

          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }}
      >
        <button className="erd-sticky__remove" onClick={onRemove} type="button">
          ×
        </button>
      </div>
      <textarea
        className="erd-sticky__text"
        onChange={(event) => onText(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        value={sticky.text}
      />
    </div>
  )
}
```

- [ ] **Step 4: Own them in the hook**

`use-erd` gains `stickies`, `addSticky()`, `moveSticky(id, at)`,
`setStickyText(id, text)` and `removeSticky(id)`, and passes them to `saveErd`.
`addSticky` places a new note at the centre of the current view:

```ts
    addSticky: useCallback(() => {
      setStickies((current) => [
        ...current,
        {
          id: `s${Date.now().toString(36)}`,
          text: '',
          // Placed where you are looking, not at the origin, which on a fitted
          // diagram is off screen.
          x: Math.round(-view.x / view.z) + 60,
          y: Math.round(-view.y / view.z) + 60,
        },
      ])
    }, [view]),
```

`dirty` gains the stickies: `code !== committed || JSON.stringify(stickies) !== committedStickies`.

- [ ] **Step 5: Probe the reader**

Add `erd3/stickies.mjs`:

```js
const { readStickies } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }

// Review Focus 3: een layoutbestand van voor de stickies.
check('RF3 ontbrekend veld geeft een lege lijst', readStickies(undefined).length === 0)
check('RF3 null geeft een lege lijst', readStickies(null).length === 0)
check('RF3 rommel geeft een lege lijst', readStickies('kapot').length === 0)
check('geldige sticky komt door', readStickies([{ id: 'a', text: 'hoi', x: 1, y: 2 }]).length === 1)
check('halve sticky wordt overgeslagen', readStickies([{ id: 'a', text: 'hoi' }, { id: 'b', text: 'ok', x: 0, y: 0 }]).length === 1)
check('en de goede blijft', readStickies([{ id: 'a' }, { id: 'b', text: 'ok', x: 0, y: 0 }])[0].id === 'b')

console.log(bad === 0 ? '\nTask 4: alles groen' : `\nTask 4: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 6: Verify in the app**

Add a sticky, type in it, drag it, save. Then in the monorepo check
`git diff laravel/server/database/schema.layout.json` shows the note, and that
`schema.dbml` is **unchanged** — a sticky must not touch the portable file.
Reopen the view: the note is where you left it.

Review Focus 3's other half: delete a table that a sticky sits next to and save.
Expected: the sticky survives, because it is anchored to the canvas and not to
the table.

- [ ] **Step 7: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd src/shared/erd.ts src/main/erd/store.ts src/renderer/src/app.css
git commit -m "feat(erd): sticky notes on the canvas, kept beside the layout"
```

---

### Task 5: Import from migrations, and the example

**Files:**
- Create: `src/renderer/src/erd/example.ts`
- Create: `src/main/erd/migrations.ts`
- Modify: `src/main/tools/schema.ts` — the connection becomes a parameter
- Modify: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/erd/use-erd.ts`, `erd-view.tsx`

**Interfaces:**
- Consumes: `schemaTables` from `../tools/schema`, `runDocker`
- Produces: `window.ray.erdFromMigrations(containerId, workingDir)` → `Promise<{ tables: SchemaTable[]; error: string | null }>`; `export const NETOS_EXAMPLE: string`

**Why it runs the migrations instead of reading them:** a migration is PHP and
may branch, loop or call a helper, so parsing it is a guess while running it is
the definition.

**Why it reuses `schemaTables`:** that function already runs a PHP program in
the container that asks the schema builder for tables, columns, indexes and
keys, and shapes them into `SchemaTable`. Writing a second reader in the Laravel
package would give the project two definitions of "read a schema" that have to
be kept in step. Instead `schemaTables` grows one parameter.

- [ ] **Step 1: Let the schema reader target another connection**

`schemaTables(containerId, workingDir, tenant)` builds its PHP with an
`initialise` block that sets the tenant. Add a fourth, optional argument and
one more branch — nothing else in the function changes:

```ts
export async function schemaTables(
  containerId: string,
  workingDir: string,
  tenant: string,
  /** Reads this connection instead of the default one. */
  connection = '',
): Promise<SchemaTable[]> {
```

and in `program`, when `connection !== ''`, the initialise block becomes:

```ts
    `Illuminate\\Support\\Facades\\DB::setDefaultConnection(${JSON.stringify(connection)});`
```

Setting the default connection rather than threading one through every call
keeps the rest of the program — which asks `Schema::getFacadeRoot()` and
`DB::connection()` with no argument — exactly as it is.

- [ ] **Step 2: Create, migrate, read, drop**

`src/main/erd/migrations.ts`:

```ts
import type { SchemaTable } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'
import { schemaTables } from '../tools/schema'

const MIGRATE_TIMEOUT_MS = 180_000
const CONNECTION = 'netos-debug-migrations'

/**
 * The schema as the repository's migrations describe it, rather than as the
 * database happens to stand.
 *
 * The scratch database is created, migrated into, read and dropped here, and is
 * never one the application uses. The drop runs whatever happened, so a
 * migration that throws halfway leaves nothing behind.
 */
export async function schemaFromMigrations(
  containerId: string,
  workingDir: string,
): Promise<{ tables: SchemaTable[]; error: string | null }> {
  const root = workingDir || '/var/www/html'
  const database = `netos_debug_erd_${Math.random().toString(36).slice(2, 10)}`

  const php = (body: string): Promise<{ stdout: string; stderr: string; code: number }> =>
    runDocker(['exec', '-i', '-w', root, containerId, 'php'], program(root, database, body), MIGRATE_TIMEOUT_MS).catch(
      (error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }),
    )

  const created = await php(`
$__default = config('database.connections.' . config('database.default'));
config(['database.connections.${CONNECTION}' => ['database' => '${database}'] + $__default]);
Illuminate\\Support\\Facades\\DB::statement('CREATE DATABASE \`${database}\`');
Illuminate\\Support\\Facades\\Artisan::call('migrate', [
    '--database' => '${CONNECTION}',
    '--force' => true,
    '--no-interaction' => true,
]);
echo 'ok';`)

  if (!created.stdout.includes('ok')) {
    await drop(containerId, root, database)

    return { tables: [], error: firstLine(created.stderr || created.stdout) || 'The migrations did not run.' }
  }

  try {
    return { tables: await schemaTables(containerId, root, '', CONNECTION), error: null }
  } finally {
    await drop(containerId, root, database)
  }
}

async function drop(containerId: string, root: string, database: string): Promise<void> {
  await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    program(root, database, `Illuminate\\Support\\Facades\\DB::statement('DROP DATABASE IF EXISTS \`${database}\`');`),
    MIGRATE_TIMEOUT_MS,
  ).catch(() => ({ stdout: '', stderr: '', code: 1, timedOut: false }))
}

function program(root: string, database: string, body: string): string {
  return `<?php
require ${'`${JSON.stringify(root)}`'} . '/vendor/autoload.php';
$__app = require ${'`${JSON.stringify(root)}`'} . '/bootstrap/app.php';
$__app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

${'${body}'}
`
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0] ?? ''
}
```

The `CREATE DATABASE` runs on the default connection, which is already
connected to the server; the scratch connection is only pointed at the new
database afterwards. Confirm that order works against this MySQL before
building the rest of the task — if `CREATE DATABASE` is refused for the
application's user, the whole approach needs the user's say-so about
credentials, which is a question for your human partner rather than a ruling.

- [ ] **Step 3: Bridge it**

In `main/index.ts`, beside the other `erd:` handlers:

```ts
  ipcMain.handle('erd:migrations', (_event, containerId: string, workingDir: string) =>
    schemaFromMigrations(containerId, workingDir),
  )
```

and in `preload/index.ts`, beside `readErd`:

```ts
  erdFromMigrations(
    containerId: string,
    workingDir: string,
  ): Promise<{ tables: SchemaTable[]; error: string | null }> {
    return ipcRenderer.invoke('erd:migrations', containerId, workingDir)
  },
```

- [ ] **Step 4: Write the example**

```ts
/**
 * A short document for an empty project, so the view has something to show
 * before a container is picked. Deliberately small: it exists to demonstrate
 * the shape of DBML, not to be a NetOS schema.
 */
export const NETOS_EXAMPLE = `Enum booking_status {
  pending
  confirmed
  cancelled
}

Table tenants {
  id bigint [pk, not null]
  slug varchar(255) [unique, not null]
  name varchar(255) [not null]
}

Table users {
  id bigint [pk, not null]
  tenant_id bigint [not null]
  email varchar(255) [unique, not null]
  Note: 'One row per person, per tenant.'
}

Table bookings {
  id bigint [pk, not null]
  user_id bigint [not null]
  status booking_status [not null]
  starts_at timestamp [not null]
}

Ref: users.tenant_id > tenants.id [delete: cascade]
Ref: bookings.user_id > users.id [delete: cascade]

TableGroup tenancy {
  tenants
  users
}
`
```

- [ ] **Step 5: Offer all three**

`use-erd` gains `importFromMigrations()` — which calls
`window.ray.erdFromMigrations`, then `toDbml(schemaToModel(tables, 'central', 'central'))`
— and `insertExample()`, which is `setCode(NETOS_EXAMPLE)`. The empty state
gains the design's other two buttons beside the one Plan A shipped, and all
three go through the same unsaved-work confirmation `importing()` already
applies.

- [ ] **Step 6: Verify in the app**

1. Press **Insert NetOS example** on an empty source. Expected: four tables, two relations, a group rectangle, and `status` coloured as an enum.
2. Press **Import from migrations** with a container picked. Expected: a diagram that matches **Import from MySQL**, or differs exactly where the database has drifted from the migrations.
3. Review Focus 4: add `throw new \Exception('x');` to the top of the newest migration's `up()`, press the button. Expected: a readable error, the editor's contents untouched, and

```bash
docker compose exec -T php php artisan db:show --json 2>/dev/null | head -1
docker compose exec -T mysql mysql -uroot -proot -N -e "show databases like 'netos_debug_erd_%'"
```

printing no rows. Undo the migration afterwards.

- [ ] **Step 7: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd src/main/erd/migrations.ts src/main/tools/schema.ts src/main/index.ts src/preload/index.ts
git commit -m "feat(erd): import from migrations, and a built-in example"
```

---

### Task 6: The sidebar

**Files:**
- Create: `src/renderer/src/erd/erd-sidebar.tsx`
- Modify: `src/renderer/src/erd/use-erd.ts`, `erd-view.tsx`, `erd-canvas.tsx`, `app.css`

**Interfaces:**
- Consumes: `enumUses` from `./enums`, `ErdModel`
- Produces: `use-erd` gains `query`, `setQuery`, `scope`, `setScope`, `shown: ErdModel`

- [ ] **Step 1: Narrow the model**

The canvas draws whatever model it is handed, so filtering is one function:

```ts
/**
 * The model the canvas draws, narrowed by the search and the scope.
 *
 * Relations are kept only when both ends survive — a line to a table that is
 * filtered out has nowhere to land, which is the same reason a cross-database
 * reference is not drawn.
 */
function narrow(model: ErdModel, query: string, scope: string): ErdModel {
  const needle = query.trim().toLowerCase()
  const group = model.groups.find((one) => one.name === scope)

  const tables = model.tables.filter((table) => {
    if (group !== undefined && !group.tables.includes(table.name)) {
      return false
    }

    return (
      needle === '' ||
      table.name.toLowerCase().includes(needle) ||
      table.columns.some((column) => column.name.toLowerCase().includes(needle))
    )
  })

  const present = new Set(tables.map((table) => table.name))

  return {
    ...model,
    tables,
    relations: model.relations.filter(
      (one) => present.has(one.from.table) && present.has(one.to.table),
    ),
  }
}
```

`shown` is `useMemo(() => narrow(model, query, scope), [model, query, scope])`,
and `ErdView` passes `erd.shown` to the canvas while everything else — the
editor, the problems, saving — keeps using the full `model` and `code`.

- [ ] **Step 2: Write the sidebar**

```tsx
import { enumUses } from './enums'
import type { ErdModel } from './model'

type ErdSidebarProps = {
  model: ErdModel
  query: string
  scope: string
  onQuery: (query: string) => void
  onScope: (scope: string) => void
}

export function ErdSidebar({ model, query, scope, onQuery, onScope }: ErdSidebarProps) {
  const uses = enumUses(model)
  const noted = model.tables.filter((table) => table.note !== null)

  return (
    <aside className="erd-side">
      <input
        className="input input--text erd-side__search"
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search tables and columns"
        type="text"
        value={query}
      />

      <select
        className="input input--select erd-side__scope"
        onChange={(event) => onScope(event.target.value)}
        value={scope}
      >
        <option value="">All tables</option>
        {model.groups.map((group) => (
          <option key={group.name} value={group.name}>
            {group.name}
          </option>
        ))}
      </select>

      {uses.length === 0 ? null : (
        <div className="erd-side__group">
          <div className="erd-side__title">Enums</div>
          {uses.map((use) => (
            <div className="erd-side__row" key={use.enum.name} title={use.enum.values.join(', ')}>
              <span className="erd-side__name">{use.enum.name}</span>
              <span className="erd-side__count">{use.enum.values.length}</span>
            </div>
          ))}
        </div>
      )}

      {noted.length === 0 ? null : (
        <div className="erd-side__group">
          <div className="erd-side__title">Notes</div>
          {noted.map((table) => (
            <div className="erd-side__row" key={table.name} title={table.note ?? ''}>
              <span className="erd-side__name">{table.name}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
```

The rows carry their content in a `title` rather than linking into the editor:
putting the caret on a declaration needs the editor to expose its textarea,
which it does not, and adding that for a convenience is more than this task is
worth. If it proves wanted, it is the same mechanism the problems list would
need, and both should get it at once.

- [ ] **Step 3: Say when nothing matches**

Review Focus 5: a search matching nothing must not look like a broken canvas.
When `erd.shown.tables.length === 0` and the full model is not empty, the canvas
area shows `No table matches “<query>”.` with a button that clears the search.

- [ ] **Step 4: Probe the narrowing**

Add `erd3/narrow.mjs` exercising: a query matching a table name; a query
matching only a column name; a query matching nothing (empty tables, empty
relations); a scope naming a group (only its tables); a scope naming a group
with one table (exactly one, no relations); and query plus scope together.
Export `narrow` from `use-erd.ts` for the probe to reach it.

```js
const { narrow } = await import('./bundle.mjs')
let bad = 0
const check = (l, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FOUT'} ${l}${extra ? ' | ' + extra : ''}`) }
const col = (name) => ({ name, type: 'int', nullable: true, primary: false, unique: false, references: null })
const t = (name, cols) => ({ name, database: '', note: null, indexes: [], columns: cols.map(col) })
const model = {
  tables: [t('users', ['id', 'email']), t('bookings', ['id', 'user_id']), t('tenants', ['id'])],
  relations: [{ from: { table: 'bookings', column: 'user_id' }, to: { table: 'users', column: 'id' }, onDelete: '', crossDatabase: false }],
  enums: [],
  groups: [{ name: 'tenancy', tables: ['users', 'tenants'] }],
}

check('lege zoekterm toont alles', narrow(model, '', '').tables.length === 3)
check('zoekt op tabelnaam', narrow(model, 'book', '').tables.length === 1)
check('zoekt op kolomnaam', narrow(model, 'email', '').tables.map(x => x.name).join() === 'users')
// Review Focus 5: niets gevonden.
check('RF5 geen match geeft nul tabellen', narrow(model, 'zzz', '').tables.length === 0)
check('RF5 en nul relaties', narrow(model, 'zzz', '').relations.length === 0)
check('scope beperkt tot de groep', narrow(model, '', 'tenancy').tables.map(x => x.name).join() === 'users,tenants')
check('relatie met een kant buiten beeld vervalt', narrow(model, '', 'tenancy').relations.length === 0)
check('relatie binnen beeld blijft', narrow(model, '', '').relations.length === 1)
check('scope plus zoekterm', narrow(model, 'user', 'tenancy').tables.map(x => x.name).join() === 'users')
// RF5: een scope met precies 1 tabel.
check('RF5 scope met een enkele tabel', narrow({ ...model, groups: [{ name: 'solo', tables: ['tenants'] }] }, '', 'solo').tables.length === 1)

console.log(bad === 0 ? '\nTask 6: alles groen' : `\nTask 6: ${bad} FOUT`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 5: Verify in the app**

Search for a column name that exists in one table; expected: one card, no
dangling lines. Search for nonsense; expected: the message and a working clear
button. Pick a group in the scope; expected: only its tables, and the group
rectangle still around them.

- [ ] **Step 6: Commit**

```bash
npm run typecheck && npx electron-vite build
git add src/renderer/src/erd src/renderer/src/app.css
git commit -m "feat(erd): search the schema and narrow it to a group"
```

---

## Carried over from Plan A's review

These were deferred, not fixed. They are listed here so they are not lost, and
they are **not** part of this plan unless you say so:

- `dirty` ignores the layout, so dragging cards and then reloading does not prompt. Task 4 touches `dirty` for stickies and could take it then.
- An open column form can revert a rename made in the text pane (uncontrolled `defaultValue`, never re-keyed).
- `setHeaderColor` drops a table alias and would mis-locate a brace inside a quoted name. Unreachable — nothing calls it. The design's "Header color" control would be the thing that wires it.
- `quoteName` escapes an embedded double quote as `\"`, which DBML rejects.
- A column that a `Ref` points at cannot be renamed from the canvas; the refusal is correct but unexplained.
- `parse.ts` reads `schemas[0]` only, so a second DBML schema is invisible.

## Done when

- An enum's columns are marked on their cards and listed in the sidebar.
- A table group is drawn around its tables, and a group naming a missing table still draws correctly around the rest.
- A sticky note survives a save, a reload and the deletion of the table beside it, and never appears in `schema.dbml`.
- Importing from migrations produces a diagram, and a broken migration leaves no scratch database behind.
- Searching narrows the canvas and says so when nothing matches.
- `npm run typecheck` is silent and `npx electron-vite build` succeeds.
