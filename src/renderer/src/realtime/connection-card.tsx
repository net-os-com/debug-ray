import { useEffect, useState } from 'react'
import type { RealtimeState } from './use-realtime'

const LABELS: Record<string, string> = {
  idle: 'Not connected',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  failed: 'Connection failed',
}

export function ConnectionCard({ realtime }: { realtime: RealtimeState }) {
  const uptime = useUptime(realtime.connectedAt)

  return (
    <div className="realtime__connection">
      <div className="realtime__conn-head">
        <span className={`realtime__dot realtime__dot--${realtime.status}`} />
        <span className="realtime__conn-state">{LABELS[realtime.status] ?? realtime.status}</span>
        {uptime === '' ? null : <span className="realtime__conn-uptime">{uptime}</span>}
      </div>

      <div className="realtime__conn-line" title={realtime.url}>
        {realtime.url === '' ? 'No broadcasting key read yet' : realtime.url.split('?')[0]}
      </div>

      <div className="realtime__conn-meta">
        {realtime.socketId === ''
          ? realtime.detail || 'Pusher protocol 7'
          : `socket ${realtime.socketId} · Pusher protocol 7`}
      </div>

      {realtime.credentials.driver !== '' && realtime.credentials.driver !== 'pusher' ? (
        <div className="realtime__conn-warn">
          This application broadcasts over <code>{realtime.credentials.driver}</code>, so nothing
          will arrive here. Set <code>BROADCAST_CONNECTION=pusher</code> to watch it.
        </div>
      ) : null}

      {realtime.credentials.error === null ? null : (
        <div className="realtime__conn-warn">{realtime.credentials.error}</div>
      )}

      <label className="realtime__actor">
        Auth as
        <select
          onChange={(event) => realtime.setActorId(event.target.value)}
          value={realtime.actorId}
        >
          {realtime.actors.length === 0 ? <option value="">No users read</option> : null}
          {realtime.actors.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
              {user.roles.length === 0 ? '' : ` · ${user.roles.join(', ')}`}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** Counts up while connected, so a quiet channel still shows a live window. */
function useUptime(since: number | null): string {
  const [, tick] = useState(0)

  useEffect(() => {
    if (since === null) {
      return
    }

    const timer = setInterval(() => tick((current) => current + 1), 1_000)

    return () => clearInterval(timer)
  }, [since])

  if (since === null) {
    return ''
  }

  const seconds = Math.floor((Date.now() - since) / 1_000)

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
