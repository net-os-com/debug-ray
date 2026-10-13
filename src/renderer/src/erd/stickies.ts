import type { Layout, Point } from './arrange'
import type { ErdModel, ErdNote } from './model'

/**
 * A standalone note, placed on the canvas.
 *
 * The note itself lives in the DBML as `Note name { '…' }`, so it travels with
 * the schema and shows up in a diff; only where it sits is in the layout file.
 * That split is the same one the tables use, and it is why a note survives a
 * re-import that replaces the whole source.
 *
 * `@dbml/core` at this version cannot parse the block, so it is lifted out of
 * the source before parsing and written back on save — see `prepass.ts`.
 */
export type Sticky = { name: string; text: string; x: number; y: number }

/** The layout key a note's position is stored under, kept clear of table names. */
export function stickyKey(name: string): string {
  return `note:${name}`
}

/** Notes with a position, in declaration order. */
export function stickies(model: ErdModel, layout: Layout): Sticky[] {
  return model.notes.map((note, index) => {
    const at = layout[stickyKey(note.name)] ?? fallback(index)

    return { name: note.name, text: note.text, x: at.x, y: at.y }
  })
}

/**
 * Where a note with no stored position goes.
 *
 * Off to the left of the first layout column rather than at the origin, so a
 * note added to the source does not land on top of a table.
 */
function fallback(index: number): Point {
  return { x: -320, y: index * 180 }
}

/** The source a note's text is edited into, as DBML. */
export function renameNote(notes: ErdNote[], name: string, text: string): ErdNote[] {
  return notes.map((note) => (note.name === name ? { ...note, text } : note))
}
