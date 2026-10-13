/** Where a table's card sits on the canvas. */
export type ErdPoint = { x: number; y: number }

/** What the package hands back; the DBML itself is never read in. */
export type ErdStored = {
  layout: Record<string, ErdPoint>
  savedAt: string | null
  error: string | null
}

export type ErdSaved = {
  files: string[]
  error: string | null
}
