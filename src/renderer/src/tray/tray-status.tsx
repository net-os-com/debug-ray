import type { ServerStatus } from '../../../shared/ray-event'
import { useServerStatus } from '../use-server-status'

type State = 'listening' | 'failed' | 'starting'

function stateOf(status: ServerStatus | null): State {
  if (status?.listening) {
    return 'listening'
  }

  return status?.error ? 'failed' : 'starting'
}

function textOf(status: ServerStatus | null, state: State): string {
  if (state === 'listening' && status) {
    return `Listening on ${status.host}:${status.port}`
  }

  if (state === 'failed' && status) {
    return `Not listening — ${status.error}`
  }

  return 'Starting…'
}

/** Whether the receiver is up: the first thing worth knowing at a glance. */
export function TrayStatus() {
  const status = useServerStatus()
  const state = stateOf(status)

  return (
    <div className="tray__status" data-state={state}>
      <span className="tray__dot" />
      <span className="tray__status-text">{textOf(status, state)}</span>
    </div>
  )
}
