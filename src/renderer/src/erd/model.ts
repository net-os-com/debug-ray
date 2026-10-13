/**
 * Card geometry, declared once.
 *
 * The arranger spaces cards by it, the relation layer anchors lines on it and
 * `fitView` measures with it. Three independent copies of these numbers would
 * only have to drift by one for cards to overlap or for every line to come
 * away from the row it points at.
 */
export const CARD_WIDTH = 240
export const COLUMN_ROW_HEIGHT = 22
/** Where the first column row starts, measured from the top of the card. */
export const CARD_HEADER_HEIGHT = 34

/** What the canvas and the serialiser both read, so neither touches SchemaTable. */
export type ErdModel = {
  tables: ErdTable[]
  relations: ErdRelation[]
}

export type ErdTable = {
  name: string
  /** Which database it came from, for the tenancy label on the card. */
  database: string
  columns: ErdColumn[]
  indexes: ErdIndex[]
}

export type ErdColumn = {
  name: string
  type: string
  nullable: boolean
  primary: boolean
  unique: boolean
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
