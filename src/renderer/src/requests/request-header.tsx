import { CopyButton } from '../ui/copy-button'
import { statusBackground, statusColor } from './request-colors'
import { toCurl } from './to-curl'
import type { HttpRequest } from './types'

export function RequestHeader({ request }: { request: HttpRequest }) {
  const meta = [
    { key: 'Route', value: request.route ?? '—' },
    { key: 'Action', value: request.action ?? '—' },
    { key: 'Middleware', value: request.middleware.join(', ') || '—' },
    { key: 'Duration', value: `${request.durationMs} ms` },
    { key: 'Memory', value: request.memoryMb === null ? '—' : `${request.memoryMb} MB` },
    { key: 'Time', value: new Date(request.startedAt).toLocaleString() },
  ]

  return (
    <div className="request-header">
      <div className="request-header__top">
        <span className="request-header__method">{request.method}</span>
        <span className="request-header__uri">{request.uri}</span>
        <span
          className="request-header__status"
          style={{
            background: statusBackground(request.status),
            color: statusColor(request.status),
          }}
        >
          {request.status}
        </span>
        <div className="request-header__actions">
          <CopyButton label="Copy as cURL" text={toCurl(request)} />
          <button
            className="button button--primary"
            disabled
            title="Replaying needs a collector in the application; that comes later."
            type="button"
          >
            Replay
          </button>
        </div>
      </div>

      <div className="request-header__meta">
        {meta.map((row) => (
          <div className="request-header__meta-row" key={row.key}>
            <span className="request-header__meta-key">{row.key}</span>
            <span className="request-header__meta-value">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
