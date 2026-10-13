import { CARD_WIDTH, type ErdModel } from './model'

export type Point = { x: number; y: number }
export type Layout = Record<string, Point>

const COLUMN_GAP = 96
const ROW_GAP = 48
/** Vertical pitch between cards — not the height of a row inside one. */
const CARD_PITCH = 320
const PER_LAYER = 4

/**
 * Places every table, keeping any position already stored.
 *
 * Layered by relation depth: tables that reference nothing come first, then
 * each layer holds the tables whose references are all already placed. The
 * result is the same every run, which a force-directed layout is not — and on a
 * schema this size, "it moved and I cannot tell why" is a thing you would have
 * to debug.
 */
export function arrange(model: ErdModel, stored: Layout): Layout {
  const placed: Layout = {}
  const names = model.tables.map((table) => table.name)
  const present = new Set(names)

  // A stored position for a table that no longer exists is dropped rather than
  // carried, so a removed table cannot corrupt the file.
  for (const name of names) {
    const position = stored[name]

    if (position) {
      placed[name] = position
    }
  }

  const remaining = names.filter((name) => !(name in placed))

  if (remaining.length === 0) {
    return placed
  }

  for (const [index, name] of layered(model, remaining, present).entries()) {
    const layer = Math.floor(index / PER_LAYER)
    const row = index % PER_LAYER

    placed[name] = {
      x: layer * (CARD_WIDTH + COLUMN_GAP),
      y: row * (CARD_PITCH + ROW_GAP),
    }
  }

  return placed
}

/**
 * Orders the unplaced tables so a table follows the ones it references.
 *
 * A cycle — `users` references `teams` which references `users` — would leave
 * both waiting on the other forever, so once a pass places nothing the rest are
 * emitted in name order and the loop ends.
 */
function layered(model: ErdModel, remaining: string[], present: Set<string>): string[] {
  const targets = new Map<string, Set<string>>()

  for (const name of remaining) {
    targets.set(name, new Set())
  }

  for (const relation of model.relations) {
    const from = targets.get(relation.from.table)

    if (from && present.has(relation.to.table) && relation.to.table !== relation.from.table) {
      from.add(relation.to.table)
    }
  }

  const ordered: string[] = []
  const done = new Set<string>()
  let pending = [...remaining].sort()

  while (pending.length > 0) {
    const ready = pending.filter((name) =>
      [...(targets.get(name) ?? [])].every(
        (target) => done.has(target) || !pending.includes(target),
      ),
    )

    if (ready.length === 0) {
      ordered.push(...pending)
      break
    }

    for (const name of ready) {
      ordered.push(name)
      done.add(name)
    }

    pending = pending.filter((name) => !done.has(name))
  }

  return ordered
}
