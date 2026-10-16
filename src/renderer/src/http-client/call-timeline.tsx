import type { OutgoingCall } from '../../../shared/http-client'

/**
 * The phases of one call, drawn as a timeline rather than as a list of numbers.
 *
 * The same shape the Requests view uses for a request's own timeline, because
 * the question is the same one: not "how long did it take" but "where did the
 * time go". A reused connection answers that by showing nothing for the first
 * three phases, which is worth seeing.
 *
 * The colours are the canvas' own ramp, declared in the tokens: a progression
 * through the phases rather than five unrelated hues, which is what makes the
 * handshakes legible beside each other.
 */
const PHASES: { key: string; label: string; color: string }[] = [
  { key: 'dns', label: 'Name lookup', color: 'var(--tm-1)' },
  { key: 'connect', label: 'Connect', color: 'var(--tm-2)' },
  { key: 'tls', label: 'TLS handshake', color: 'var(--tm-3)' },
  { key: 'firstByte', label: 'Waiting for the server', color: 'var(--tm-4)' },
  { key: 'download', label: 'Download', color: 'var(--tm-5)' },
]

export function CallTimeline({ call }: { call: OutgoingCall }) {
  const phases = laidOut(call)

  if (phases.length === 0) {
    return (
      <div className="api-pairs__empty">
        No phase timing for this call. curl reports it, so a call answered by
        something else — a faked response, another handler — has none.
      </div>
    )
  }

  const total = call.timing.total ?? call.durationMs
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="hc-timeline">
      <div className="hc-timeline__head">
        <span className="hc-timeline__label">Phase</span>
        <span className="hc-timeline__ticks">
          {ticks.map((at) => (
            <span className="hc-timeline__tick" key={at} style={{ left: `${at * 100}%` }}>
              {Math.round(total * at)} ms
            </span>
          ))}
        </span>
      </div>

      {phases.map((phase) => (
        <div className="hc-timeline__row" key={phase.key}>
          <span className="hc-timeline__label">
            <span className="hc-timeline__dot" style={{ background: phase.color }} />
            <span className="hc-timeline__name">{phase.label}</span>
            <span className="hc-timeline__ms">{phase.ms.toFixed(1)} ms</span>
          </span>
          <span className="hc-timeline__track">
            <span
              className="hc-timeline__bar"
              style={{
                left: `${phase.from}%`,
                width: `max(3px, ${phase.width}%)`,
                background: phase.color,
              }}
            />
          </span>
        </div>
      ))}

      <div className="hc-timeline__legend">
        {PHASES.map((phase) => (
          <span className="hc-timeline__key" key={phase.key}>
            <span className="hc-timeline__dot" style={{ background: phase.color }} />
            {phase.label}
          </span>
        ))}
      </div>

      {phases.every((phase) => !['dns', 'connect', 'tls'].includes(phase.key) || phase.ms === 0) ? (
        <div className="hc-timeline__note">
          No lookup or handshake: this went over a connection that was already open.
        </div>
      ) : null}
    </div>
  )
}

type Laid = { key: string; label: string; color: string; ms: number; from: number; width: number }

/**
 * curl reports each phase as the time elapsed since the call began, so the bars
 * are the gaps between them — and the last one is whatever is left of the total.
 */
function laidOut(call: OutgoingCall): Laid[] {
  const total = call.timing.total ?? 0

  if (total <= 0) {
    return []
  }

  const marks: Record<string, number> = {
    dns: call.timing.dns ?? 0,
    connect: call.timing.connect ?? 0,
    tls: call.timing.tls ?? 0,
    firstByte: call.timing.firstByte ?? 0,
    download: total,
  }

  let at = 0

  return PHASES.map((phase) => {
    const until = Math.max(at, marks[phase.key] ?? at)
    const ms = until - at
    const laid: Laid = {
      ...phase,
      ms,
      from: (at / total) * 100,
      width: (ms / total) * 100,
    }

    at = until

    return laid
  })
}
