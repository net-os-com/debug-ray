/**
 * Sonar-ping: the rules, and nothing else.
 *
 * The core sends out rings; bugs crawl in from the edge; Space zaps every bug
 * lying on a ring at that moment. Pure functions over a plain value, so the
 * game can be checked without a browser and drawn by anything.
 *
 * Distances are in units of the play area's radius: 0 is the core's centre,
 * 1 its edge. Time is in seconds.
 */

export type Bug = {
  id: number
  /** Radians, where on the circle it crawls in from. */
  angle: number
  distance: number
  /** Radius units per second. */
  speed: number
}

export type Ring = { radius: number }

/** A zapped bug's flash, kept for its short life so it can be drawn. */
export type Zap = { angle: number; distance: number; age: number }

export type SonarGame = {
  phase: 'playing' | 'over'
  bugs: Bug[]
  rings: Ring[]
  zaps: Zap[]
  score: number
  lives: number
  /** Presses in a row that hit something. */
  streak: number
  /** Seconds Space stays dead after a miss. */
  jammedFor: number
  /** Seconds until the next ring. */
  ringIn: number
  /** Seconds until the next bug. */
  bugIn: number
  nextId: number
}

/** 0 ≤ n < 1, injected so the checks can pin it. */
export type Random = () => number

export const LIVES = 3
/** A bug this close has reached the core. */
export const CORE = 0.08
export const RING_SPEED = 0.5
/** How far off a ring a bug may be and still count as on it. */
export const TOLERANCE = 0.035
/** Long enough that holding Space down loses, short enough not to feel stuck. */
export const JAM_S = 0.35
/** The longest step taken at once, so a stall cannot jump bugs into the core. */
export const MAX_DT = 0.05
/** How long a zap's flash lasts. */
export const ZAP_S = 0.3
/** A moment's grace before the first bug, so a game does not open on one. */
const FIRST_BUG_S = 1

export function levelOf(score: number): number {
  return Math.floor(score / 10)
}

function ringEvery(level: number): number {
  return Math.max(0.9, 1.6 - 0.07 * level)
}

function bugEvery(level: number): number {
  return Math.max(0.6, 2.2 - 0.15 * level)
}

function bugSpeed(level: number): number {
  return 0.06 + 0.008 * level
}

export function newGame(): SonarGame {
  return {
    phase: 'playing',
    bugs: [],
    rings: [],
    zaps: [],
    score: 0,
    lives: LIVES,
    streak: 0,
    jammedFor: 0,
    ringIn: 0,
    bugIn: FIRST_BUG_S,
    nextId: 1,
  }
}

export function step(game: SonarGame, dt: number, random: Random): SonarGame {
  if (game.phase === 'over') {
    return game
  }

  const t = Math.min(Math.max(dt, 0), MAX_DT)
  const level = levelOf(game.score)

  const rings = game.rings
    .map((ring) => ({ radius: ring.radius + RING_SPEED * t }))
    .filter((ring) => ring.radius <= 1)
  let ringIn = game.ringIn - t

  if (ringIn <= 0) {
    rings.push({ radius: 0 })
    ringIn += ringEvery(level)
  }

  const bugs: Bug[] = []
  let lives = game.lives

  for (const bug of game.bugs) {
    const distance = bug.distance - bug.speed * t

    if (distance <= CORE) {
      lives -= 1
    } else {
      bugs.push({ ...bug, distance })
    }
  }

  let bugIn = game.bugIn - t
  let nextId = game.nextId

  if (bugIn <= 0) {
    // A little spread in speed, so bugs that arrive together do not stay
    // together all the way in.
    bugs.push({
      id: nextId,
      angle: random() * Math.PI * 2,
      distance: 1,
      speed: bugSpeed(level) * (0.8 + 0.4 * random()),
    })
    nextId += 1
    bugIn += bugEvery(level)
  }

  return {
    ...game,
    phase: lives <= 0 ? 'over' : 'playing',
    lives: Math.max(lives, 0),
    rings,
    bugs,
    zaps: game.zaps.map((zap) => ({ ...zap, age: zap.age + t })).filter((zap) => zap.age < ZAP_S),
    jammedFor: Math.max(game.jammedFor - t, 0),
    ringIn,
    bugIn,
    nextId,
  }
}

export function ping(game: SonarGame): SonarGame {
  if (game.phase === 'over' || game.jammedFor > 0) {
    return game
  }

  const onRing = (bug: Bug): boolean =>
    game.rings.some((ring) => Math.abs(bug.distance - ring.radius) <= TOLERANCE)
  const hits = game.bugs.filter(onRing)

  if (hits.length === 0) {
    return { ...game, streak: 0, jammedFor: JAM_S }
  }

  return {
    ...game,
    bugs: game.bugs.filter((bug) => !onRing(bug)),
    // One each, and one more for every extra bug the same press caught.
    score: game.score + hits.length + (hits.length - 1),
    streak: game.streak + 1,
    zaps: [
      ...game.zaps,
      ...hits.map((bug) => ({ angle: bug.angle, distance: bug.distance, age: 0 })),
    ],
  }
}
