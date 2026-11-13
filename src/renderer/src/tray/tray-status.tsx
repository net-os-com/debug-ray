import type { ServerStatus } from '../../../shared/ray-event'
import { useServerStatus } from '../use-server-status'

type State = 'listening' | 'paused' | 'failed' | 'starting'

type TrayStatusProps = {
  paused: boolean
  /** Events held back by the pause, shown when the stream resumes. */
  pending: number
}

/**
 * A receiver that is down outranks a pause: nothing is arriving to wait, and
 * that is the more urgent thing to see.
 */
function stateOf(status: ServerStatus | null, paused: boolean): State {
  if (status?.listening) {
    return paused ? 'paused' : 'listening'
  }

  return status?.error ? 'failed' : 'starting'
}

function textOf(status: ServerStatus | null, state: State, pending: number): string {
  if (state === 'paused') {
    return pending > 0 ? `Paused · ${pending} waiting` : 'Paused'
  }

  if (state === 'listening' && status) {
    return `Listening on ${status.host}:${status.port}`
  }

  if (state === 'failed' && status) {
    return `Not listening — ${status.error}`
  }

  return 'Starting…'
}

/** Whether the receiver is up: the first thing worth knowing at a glance. */
export function TrayStatus({ paused, pending }: TrayStatusProps) {
  const status = useServerStatus()
  const state = stateOf(status, paused)

  return (
    <div className="tray__status" data-state={state}>
      <span className="tray__dot" />
      <span className="tray__status-text">{textOf(status, state, pending)}</span>
    </div>
  )
}
