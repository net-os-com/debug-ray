import type { Rectangle } from 'electron'

/**
 * Where the menu bar item will sit once a title change has settled.
 *
 * Clearing the count narrows the item at once, but macOS moves it on a later
 * layout pass — measured at 30 to 100 ms — keeping its right edge where it was,
 * since the items to its right stay put. A panel placed from the bounds read
 * in between lands off-centre by half the title's width. Rather than wait an
 * unknown time, keep the right edge of `before` and take the width of `after`.
 */
export function rightAnchored(before: Rectangle, after: Rectangle): Rectangle {
  return { ...after, x: before.x + before.width - after.width }
}
