# ERD view — design

A dbdiagram.io alternative inside NetOS Debug: a canvas of the project's tables
and the relations between them, which writes a `schema.dbml` the repository can
commit.

Design canvas: `NetOS Debug ERD.dc.html` in the "Spatie Ray NetOS Debug Console"
project.

## Intent

The schema lives in migrations and in MySQL, but nothing in the repository shows
its shape. The ERD on dbdiagram.io is maintained by hand and drifts. This view
builds the picture from the database the app is already connected to, and writes
the result next to the migrations so a diff shows when the schema moved.

Success means: open the view, see the schema laid out and readable, press save,
and find a `schema.dbml` in the repository that opens correctly in dbdiagram.io.

### Decisions taken

| Decision | Choice |
|---|---|
| Scope of this pass | Read and show. Canvas, relations, auto-arrange, fit, import from MySQL, write `schema.dbml` |
| Where the file lives | `laravel/server/database/`, written by the Laravel package |
| Card positions | A separate `schema.layout.json` beside the `.dbml` |
| Direction | One way only. The ERD never writes migrations or touches the database |

Editing columns, relations and indexes by hand, enums, notes, problem detection
and "Import from migrations" are all in the design and all deliberately out of
this pass.

## The simplification this buys

In this pass `schema.dbml` is **output, not input**. The canvas is always built
from the live schema; the file is the snapshot you commit.

`schema.layout.json` is the exception, and the only file read back: positions
have to survive reopening or the arrangement is not worth making. It is JSON, so
reading it needs no parser of ours.

So nothing ever parses DBML — it is only written. That keeps `@dbml/core`, the
official parser, out of the dependency list until a later pass genuinely needs to
reopen a committed file for editing. Writing DBML is mechanical and small;
parsing it is where the bugs live, and that is a cost worth deferring until it
buys something.

## Where the data comes from

`useSchema(container, tenants)` already returns everything this needs, already
per tenant:

```ts
type SchemaTable = {
  name: string
  columns: SchemaColumn[]   // name, type, nullable, default, autoIncrement
  indexes: SchemaIndex[]    // name, columns[], unique, primary
  keys: SchemaKey[]         // columns[], table, foreignColumns[], onDelete
  ...
}
```

`keys` is the foreign-key list, which is what makes the relations drawable
without inferring anything from column names.

## Model

One shape between the schema and both consumers — the canvas and the serialiser
— so neither reaches into `SchemaTable` directly:

```ts
type ErdModel = {
  tables: ErdTable[]
  relations: ErdRelation[]
}

type ErdTable = {
  name: string
  /** Which database it came from, for the tenancy labels on the card. */
  database: string
  columns: ErdColumn[]
  indexes: ErdIndex[]
}

type ErdColumn = {
  name: string
  type: string
  nullable: boolean
  primary: boolean
  unique: boolean
  /** Set when this column is the local side of a foreign key. */
  references: { table: string; column: string } | null
}

type ErdRelation = {
  from: { table: string; column: string }
  to: { table: string; column: string }
  onDelete: string
  /** True when the two sides sit in different databases. */
  crossDatabase: boolean
}
```

`primary` and `unique` are derived from `indexes`, not guessed from the column
name, so a composite primary key marks every column it covers.

## Rendering

The design's own model, which this follows rather than reinvents:

- One layer carrying the table cards, positioned with
  `transform: translate(x, y) scale(z)`.
- One SVG overlay underneath for the relation lines, sized `1×1` with
  `overflow: visible` and `pointer-events: none`, so paths draw outside its box
  and never swallow a click meant for a card.
- Panning is a drag on the canvas background; zooming is the wheel and the
  buttons, reported as a percentage.

Cards are DOM rather than SVG because they carry real text that has to wrap,
truncate and be selectable, and because the app's existing CSS already styles
that kind of surface.

### Fit

`fit` computes the bounding box of every placed card, compares it to the
viewport, and picks the scale that contains it with a margin, clamped to the
same zoom limits as the buttons.

## Layout

Auto-arrange is layered by relation depth: tables with no outgoing foreign keys
form the first layer, then each following layer holds the tables that reference
only tables already placed, and within a layer the cards are gridded by name.

Deterministic on purpose. A force-directed layout looks better on a brochure but
settles differently every run, which makes "it moved and I do not know why" a
thing you have to debug on a schema of this size.

Positions live in `schema.layout.json`:

```json
{ "tables": { "users": { "x": 120, "y": 340 } } }
```

A table in the layout but not in the schema is ignored; a table in the schema
with no stored position is placed by auto-arrange. So a dropped table does not
corrupt the file and a new one does not need a migration of it.

## Persistence

Both files are written by the Laravel package, through a command, exactly as
`netos-debug:collections` already does for saved API requests:

```
php artisan netos-debug:erd save   # reads a JSON body on stdin: { dbml, layout }
php artisan netos-debug:erd read   # prints { layout, savedAt } as JSON on stdout
```

`save` takes the rendered DBML and the positions together and writes both files
in one go, so the two can never describe different schemas. `read` returns only
the layout, because the DBML is never read back.

The reasons are the ones already written down in `CollectionsCommand`: the app
runs `php artisan` in the container for everything else; a write endpoint on the
API would be reachable by anything that can reach the API, while a command is
reachable by whoever can already run code in the container. The file lands in
the bind mount, which is the directory git is watching.

The package owns the path, so where a project keeps its schema stays
configuration in the application rather than an assumption compiled into a
desktop app.

## The empty state

Before a container is picked, or when the schema has no tables, the canvas shows
the design's empty state rather than a blank grid. Of its three offers, this
pass wires up "Import from MySQL"; the other two belong to later passes and are
not shown yet rather than shown and dead.

## Tenancy

The design shows "Landlord · central database" and marks cross-database
references, which this schema needs: tenants live in their own databases and
some foreign keys point at the central one.

Each card reports which database it came from. A relation whose two sides sit in
different databases is drawn apart from the rest and labelled, because in MySQL
it is not a real constraint and reading it as one would be wrong.

## Out of scope

- Editing columns, relations or indexes on the canvas.
- Enums, notes and problem detection.
- "Import from migrations" — this pass imports from MySQL only.
- Parsing `schema.dbml` back in.
- Writing migrations, or any write to the database. The ERD reads.
