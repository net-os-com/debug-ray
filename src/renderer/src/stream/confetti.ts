/** Design-system colours, read from the tokens so the burst follows the theme. */
const TOKENS = [
  '--color-brand-primary-300',
  '--color-brand-primary-400',
  '--color-green-500',
  '--color-yellow-400',
  '--color-red-400',
]

const FALLBACK = ['50 144 241', '36 108 183', '16 185 129', '251 191 36', '248 113 113']

const COUNT = 160
const DURATION_MS = 2600
const GRAVITY = 0.00055

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  tilt: number
  spin: number
  color: string
}

export function palette(): string[] {
  const styles = getComputedStyle(document.documentElement)

  return TOKENS.map((token, index) => {
    const value = styles.getPropertyValue(token).trim()

    return `rgb(${value || FALLBACK[index]})`
  })
}

/** Thrown up from the bottom edge, so the burst reads as rising then falling. */
export function spawn(width: number, height: number, colors: string[]): Particle[] {
  return Array.from({ length: COUNT }, () => ({
    x: width * (0.15 + Math.random() * 0.7),
    y: height + Math.random() * 40,
    vx: (Math.random() - 0.5) * 0.55,
    vy: -(0.75 + Math.random() * 0.75),
    size: 5 + Math.random() * 7,
    tilt: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.02,
    color: colors[Math.floor(Math.random() * colors.length)],
  }))
}

export function advance(particles: Particle[], elapsed: number, delta: number): void {
  for (const particle of particles) {
    particle.vy += GRAVITY * delta
    particle.x += particle.vx * delta
    particle.y += particle.vy * delta
    particle.tilt += particle.spin * delta
  }
}

export function draw(
  context: CanvasRenderingContext2D,
  particles: Particle[],
  elapsed: number,
): void {
  const { width, height } = context.canvas

  context.clearRect(0, 0, width, height)
  // Hold full opacity for most of the run, then fade out rather than vanish.
  context.globalAlpha = Math.max(0, Math.min(1, (DURATION_MS - elapsed) / 700))

  for (const particle of particles) {
    context.save()
    context.translate(particle.x, particle.y)
    context.rotate(particle.tilt)
    context.fillStyle = particle.color
    context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2)
    context.restore()
  }

  context.globalAlpha = 1
}

export function isFinished(elapsed: number): boolean {
  return elapsed >= DURATION_MS
}
