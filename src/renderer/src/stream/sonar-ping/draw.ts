import { CORE, ZAP_S, type SonarGame } from './rules'

/** The theme's colours, read off the page so the game follows light, dark and phosphor. */
export type GameColors = {
  ring: string
  bug: string
  text: string
}

/** Room around the play area, so a bug at the edge is not clipped. */
const MARGIN = 16

/** A bug's glyph: a small body with legs either side, pointing at the core. */
const BUG_SIZE = 5

export function readColors(element: Element): GameColors {
  const style = getComputedStyle(element)
  const read = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback

  return {
    ring: read('--app-accent-fg', '#4a8fd8'),
    bug: read('--err-fg', '#d9534f'),
    text: read('--t3', '#888'),
  }
}

/**
 * One frame, in CSS pixels: the caller has already scaled the context for the
 * display's pixel ratio.
 */
export function drawGame(
  ctx: CanvasRenderingContext2D,
  game: SonarGame,
  size: { width: number; height: number },
  colors: GameColors,
): void {
  const cx = size.width / 2
  const cy = size.height / 2
  const radius = Math.max(Math.min(size.width, size.height) / 2 - MARGIN, 1)
  const point = (angle: number, distance: number): [number, number] => [
    cx + Math.cos(angle) * distance * radius,
    cy + Math.sin(angle) * distance * radius,
  ]

  ctx.clearRect(0, 0, size.width, size.height)

  // The rings: bright as they leave the core, gone as they reach the edge.
  ctx.strokeStyle = colors.ring
  ctx.lineWidth = 1.25

  for (const ring of game.rings) {
    ctx.globalAlpha = Math.max(0, 1 - ring.radius) * 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, ring.radius * radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  // The edge the bugs come from, faint.
  ctx.globalAlpha = 0.15
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()

  // The core.
  ctx.globalAlpha = 1
  ctx.fillStyle = colors.ring
  ctx.beginPath()
  ctx.arc(cx, cy, Math.max(CORE * radius * 0.5, 4), 0, Math.PI * 2)
  ctx.fill()

  // The bugs.
  ctx.fillStyle = colors.bug
  ctx.strokeStyle = colors.bug
  ctx.lineWidth = 1

  for (const bug of game.bugs) {
    const [x, y] = point(bug.angle, bug.distance)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(bug.angle)
    ctx.beginPath()
    ctx.ellipse(0, 0, BUG_SIZE, BUG_SIZE * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()

    for (const side of [-1, 1]) {
      for (const along of [-3, 0, 3]) {
        ctx.beginPath()
        ctx.moveTo(along, side * BUG_SIZE * 0.6)
        ctx.lineTo(along + 1.5, side * BUG_SIZE * 1.4)
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  // The zaps: a small ring that opens and fades where a bug was.
  for (const zap of game.zaps) {
    const [x, y] = point(zap.angle, zap.distance)
    const progress = zap.age / ZAP_S

    ctx.globalAlpha = Math.max(0, 1 - progress)
    ctx.beginPath()
    ctx.arc(x, y, BUG_SIZE + progress * 14, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalAlpha = 1
}
