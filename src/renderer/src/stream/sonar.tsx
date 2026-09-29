import type { CSSProperties } from 'react'

/**
 * The listening receiver, drawn as a slow sonar.
 *
 * It is the one thing on an empty screen that says the app is doing something,
 * so it breathes rather than spins: a spinner reads as work in progress and
 * would be a small lie on a screen whose whole point is that nothing has
 * arrived. The rings slow down the longer the wait lasts.
 */
export function Sonar({ seconds }: { seconds: number }) {
  return (
    <svg
      aria-hidden="true"
      className="sonar"
      height="132"
      style={{ '--breath': `${seconds}s` } as CSSProperties}
      viewBox="0 0 132 132"
      width="132"
    >
      <circle className="sonar__ring" cx="66" cy="66" r="20" />
      <circle className="sonar__ring sonar__ring--2" cx="66" cy="66" r="20" />
      <circle className="sonar__ring sonar__ring--3" cx="66" cy="66" r="20" />
      <circle className="sonar__core" cx="66" cy="66" r="5" />
    </svg>
  )
}
