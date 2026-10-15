/**
 * Card geometry, declared once.
 *
 * The arranger spaces cards by it, the relation layer anchors lines on it and
 * `fitView` measures with it. Three independent copies of these numbers would
 * only have to drift by one for cards to overlap or for every line to come
 * away from the row it points at.
 *
 * The values are the design's: a 248-wide card, a 38-high header and 28-high
 * rows.
 */
export const CARD_WIDTH = 248
export const COLUMN_ROW_HEIGHT = 28
/** Where the first column row starts, measured from the top of the card. */
export const CARD_HEADER_HEIGHT = 38

/**
 * How tall a card actually is.
 *
 * A fixed pitch was wrong on this schema: `activities` has twenty-four columns,
 * and anything past sixteen overlapped the card beneath it while Fit measured a
 * box that clipped it.
 */
export function cardHeight(table: { columns: unknown[] }): number {
  return CARD_HEADER_HEIGHT + table.columns.length * COLUMN_ROW_HEIGHT
}

/**
 * Which database a table lives in, as DBML's schema prefix spells it.
 *
 * `central.tenants` and `tenant.users` are the two this application has, and
 * an unqualified table lands in `public`. It drives the card's header colour
 * and the badge on it, and it is what makes a reference between two of them
 * cross-database.
 */
export type ErdScope = string

export const CENTRAL = 'central'
export const TENANT = 'tenant'
export const PUBLIC = 'public'

/** What the central schema used to be called, and still is in committed files. */
const LEGACY_CENTRAL = 'landlord'

/**
 * The scope a schema name stands for.
 *
 * `landlord` was the old spelling and is still written in every schema.dbml
 * committed before the rename. Left as it was it would be an unknown scope:
 * no colour, no match in the scope filter, and the migrations export would
 * take those tables for a tenant's. Reading it as central costs one map and
 * means an existing file keeps working; saving writes the new spelling.
 */
export function scopeOf(name: string): ErdScope {
  return name === LEGACY_CENTRAL ? CENTRAL : name
}

/** The design's header colours, by scope. */
export const SCOPE_COLORS: Record<string, string> = {
  [CENTRAL]: '#0A2D51',
  [TENANT]: '#404040',
  [PUBLIC]: '#595959',
}

/** The six the inspector offers for a table's header. */
export const SWATCHES = ['#0A2D51', '#246CB7', '#047857', '#B45309', '#B91C1C', '#404040']

/** A named set of allowed values a column's type can point at. */
export type ErdEnum = { name: string; values: string[] }

/** A `TableGroup`: a label, a colour and the tables it gathers, by qualified name. */
export type ErdGroup = { name: string; tables: string[]; color: string | null }

/**
 * A standalone `Note name { '…' }`.
 *
 * The design puts these on the canvas as sticky notes and lists them in the
 * sidebar, so they live in the committed DBML rather than in the layout file —
 * which means a note travels with the schema in a diff.
 */
export type ErdNote = { name: string; text: string }

/** The palette a group with no colour of its own cycles through. */
export const GROUP_COLORS = ['#246CB7', '#047857', '#B45309', '#B91C1C', '#7C3AED', '#0A2D51']

/** The colour a group is drawn in, by declaration or by position. */
export function groupColorOf(group: ErdGroup, index: number): string {
  return group.color ?? GROUP_COLORS[index % GROUP_COLORS.length] ?? '#246CB7'
}

/** What the canvas and the serialiser both read, so neither touches SchemaTable. */
export type ErdModel = {
  tables: ErdTable[]
  relations: ErdRelation[]
  enums: ErdEnum[]
  groups: ErdGroup[]
  notes: ErdNote[]
}

export type ErdTable = {
  /**
   * The qualified name — `central.tenants` — which is the key everything else
   * uses: the layout, the relation endpoints and the group membership. Two
   * schemas may each hold a `users`, so the bare name is not a key.
   */
  name: string
  /** The bare name, which is what the card shows. */
  label: string
  scope: ErdScope
  /** A `headercolor` setting on the table, overriding the scope's colour. */
  headerColor: string | null
  /** The table's own `Note:`, or null when it has none. */
  note: string | null
  columns: ErdColumn[]
  indexes: ErdIndex[]
}

export type ErdColumn = {
  name: string
  type: string
  nullable: boolean
  primary: boolean
  unique: boolean
  increment: boolean
  /** A `default:` setting, already unquoted. */
  defaultValue: string | null
  /** A `note:` setting, shown as a dot on the row and in its tooltip. */
  note: string | null
  /** Set when this column is the local side of a foreign key. */
  references: { table: string; column: string } | null
}

export type ErdIndex = {
  name: string
  columns: string[]
  unique: boolean
}

export type ErdRelation = {
  from: { table: string; column: string }
  to: { table: string; column: string }
  onDelete: string
  /** True when the two sides sit in different databases. */
  crossDatabase: boolean
}

/** The colour a card's header is painted, scope by default. */
export function headerColorOf(table: ErdTable): string {
  return table.headerColor ?? SCOPE_COLORS[table.scope] ?? SCOPE_COLORS[PUBLIC] ?? '#595959'
}

/** The qualified name, as DBML spells it. */
export function qualify(scope: ErdScope, label: string): string {
  return scope === PUBLIC || scope === '' ? label : `${scope}.${label}`
}
