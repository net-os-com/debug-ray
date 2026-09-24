import { hasNPlusOne, type HttpRequest } from './types'
import { methodColor, statusColor } from './request-colors'

type RequestRowProps = {
  request: HttpRequest
  selected: boolean
  onSelect: () => void
}

export function RequestRow({ request, selected, onSelect }: RequestRowProps) {
  return (
    <button
      className={selected ? 'request-row request-row--selected' : 'request-row'}
      onClick={onSelect}
      type="button"
    >
      <div className="request-row__top">
        <span className="request-row__method" style={{ color: methodColor(request.method) }}>
          {request.method}
        </span>
        <span className="request-row__uri">{request.uri}</span>
        <span className="request-row__status" style={{ color: statusColor(request.status) }}>
          {request.status}
        </span>
      </div>
      <div className="request-row__meta">
        <span>{time(request.startedAt)}</span>
        <span>{request.durationMs} ms</span>
        <span>{request.queries.length} queries</span>
        {hasNPlusOne(request) ? <span className="request-row__badge">N+1</span> : null}
      </div>
    </button>
  )
}

function time(startedAt: number): string {
  return new Date(startedAt).toLocaleTimeString(undefined, { hour12: false })
}
