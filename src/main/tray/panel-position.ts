import type { Rectangle } from 'electron'

/** Room between the icon and the panel, so it reads as dropped from it. */
const GAP = 4

/** Never flush against the edge of the screen. */
const EDGE = 8

/**
 * Where the panel goes: centred under the menu bar icon, just below it, and
 * pulled back inside the screen when the icon sits near an edge.
 *
 * The work area is the display the icon is on, minus the menu bar and Dock —
 * with several displays each has its own menu bar and its own icon.
 */
export function panelPosition(
  anchor: Rectangle,
  size: { width: number; height: number },
  workArea: Rectangle,
): { x: number; y: number } {
  const centred = Math.round(anchor.x + anchor.width / 2 - size.width / 2)
  const min = workArea.x + EDGE
  const max = workArea.x + workArea.width - size.width - EDGE

  return {
    x: Math.min(Math.max(centred, min), max),
    y: Math.round(anchor.y + anchor.height + GAP),
  }
}
