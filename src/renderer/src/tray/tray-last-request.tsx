import { formatDuration } from '../duration'
import { methodColor, statusColor } from '../requests/request-colors'
import { hasNPlusOne, type HttpRequest } from '../requests/types'
import { pathOf } from '../requests/uri-parts'

type TrayLastRequestProps = {
  request: HttpRequest
  /** At or above this the duration shows red, as Settings defines slow. */
  slowMs: number
  onOpen: (id: string) => void
}

/**
 * What the last HTTP request did, on one line above the stream's events:
 * where it went, how it ended, how long it took and how many queries it ran.
 * Coloured the way the Requests list colours them, so the two read alike. A
 * click opens the Requests view on it.
 */
export function TrayLastRequest({ request, slowMs, onOpen }: TrayLastRequestProps) {
  const slow = request.durationMs >= slowMs

  return (
    <button
      type="button"
      className="tray-request"
      title={request.uri}
      onClick={() => onOpen(request.id)}
    >
      <span className="tray-request__method" style={{ color: methodColor(request.method) }}>
        {request.method}
      </span>
      <span className="tray-request__path">{pathOf(request.uri)}</span>
      <span className="tray-request__meta">
        <span style={{ color: statusColor(request.status) }}>{request.status}</span>
        {' · '}
        <span className={slow ? 'tray-request__slow' : undefined}>
          {formatDuration(request.durationMs)}
        </span>
        {` · ${request.queries.length} ${request.queries.length === 1 ? 'query' : 'queries'}`}
      </span>
      {hasNPlusOne(request) ? <span className="tray-request__badge">N+1</span> : null}
    </button>
  )
}
