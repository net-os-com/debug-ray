import { formatDuration } from '../duration'
import { CopyButton } from '../ui/copy-button'
import { statusBackground, statusColor } from './request-colors'
import { toCurl } from './to-curl'
import type { HttpRequest, MiddlewareEntry } from './types'
import { pathOf, readableQuery } from './uri-parts'

export function RequestHeader({ request }: { request: HttpRequest }) {
  const query = readableQuery(request.uri)

  const meta = [
    { key: 'Route', value: request.route?.name ?? '—' },
    { key: 'Action', value: request.route?.action ?? '—' },
    { key: 'Middleware', value: middlewareSummary(request.route?.middleware ?? []) },
    { key: 'Duration', value: formatDuration(request.durationMs) },
    { key: 'Memory', value: request.memoryMb === null ? '—' : `${request.memoryMb} MB` },
    { key: 'Time', value: new Date(request.startedAt).toLocaleString() },
    ...(query === null ? [] : [{ key: 'Query', value: query }]),
  ]

  return (
    <div className="request-header">
      <div className="request-header__top">
        <span className="request-header__method">{request.method}</span>
        <span className="request-header__uri" title={request.uri}>
          {pathOf(request.uri)}
        </span>
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

/**
 * A summary, not the stack: the header is one line, and the resolved stack runs
 * to a dozen entries. The Route tab lists them all.
 */
function middlewareSummary(middleware: MiddlewareEntry[]): string {
  if (middleware.length === 0) {
    return '—'
  }

  const shown = middleware.slice(0, 3).map((entry) => entry.name).join(', ')
  const rest = middleware.length - 3

  return rest > 0 ? `${shown} +${rest} more` : shown
}
