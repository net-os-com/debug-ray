import { CARD_WIDTH, cardHeight, type ErdModel } from './model'

export type Point = { x: number; y: number }
export type Layout = Record<string, Point>

const COLUMN_GAP = 96
const ROW_GAP = 48
/** How tall a column may grow before the next one starts. */
const COLUMN_LIMIT = 1_400

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

  // New cards start past everything already placed, so a table that appears
  // after a migration does not land underneath one you positioned by hand.
  const below = Object.values(placed).reduce((lowest, point) => Math.max(lowest, point.y), 0)
  const top = Object.keys(placed).length > 0 ? below + COLUMN_LIMIT : 0
  const heights = new Map(model.tables.map((table) => [table.name, cardHeight(table)]))

  let x = 0
  let y = top

  for (const name of layered(model, remaining, present)) {
    const height = heights.get(name) ?? 0

    // Each column is filled until it would run past the limit, so a card is
    // never placed on top of the one above it however many columns it has.
    if (y > top && y + height > top + COLUMN_LIMIT) {
      x += CARD_WIDTH + COLUMN_GAP
      y = top
    }

    placed[name] = { x, y }
    y += height + ROW_GAP
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
