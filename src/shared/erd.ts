/** Where a table's card sits on the canvas. */
export type ErdPoint = { x: number; y: number }

/** What the package hands back; the DBML itself is never read in. */
/** A free note on the canvas. DBML has no place for one, so it rides along. */
export type ErdSticky = { id: string; text: string; x: number; y: number }

export type ErdStored = {
  /** The committed diagram, read back so the editor opens on it. */
  dbml: string
  stickies: ErdSticky[]
  layout: Record<string, ErdPoint>
  savedAt: string | null
  error: string | null
}

export type ErdSaved = {
  files: string[]
  error: string | null
}
