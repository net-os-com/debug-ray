import { QueryDetail } from './query-detail'
import { tokenize } from './sql-tokens'
import { SLOW_QUERY_MS, type HttpRequest, type Query } from './types'

type QueryRowProps = {
  request: HttpRequest
  query: Query
  index: number
  repeats: number
  withBindings: boolean
  open: boolean
  onToggle: () => void
}

export function QueryRow({
  request,
  query,
  index,
  repeats,
  withBindings,
  open,
  onToggle,
}: QueryRowProps) {
  const slow = query.durationMs >= SLOW_QUERY_MS
  const duplicate = repeats > 1

  const stripe = slow ? 'var(--warn-line)' : duplicate ? 'var(--err-fg)' : 'transparent'
  const bar = slow ? 'var(--warn-line)' : duplicate ? 'var(--err-fg)' : 'var(--sql-kw)'

  return (
    <div
      className={open ? 'query-row query-row--open' : 'query-row'}
      style={{ borderLeftColor: stripe }}
    >
      <div className="query-row__main" onClick={onToggle}>
        <span className="query-row__n">{index + 1}</span>

        <div className="query-row__body">
          <div className={open ? 'query-row__sql' : 'query-row__sql query-row__sql--clamped'}>
            {tokenize(query.sql, query.bindings, withBindings).map((token, position) => (
              <span
                key={position}
                style={{ color: token.color, fontWeight: token.bold ? 600 : 400 }}
              >
                {token.text}
              </span>
            ))}
          </div>
          <div className="query-row__meta">
            <span className="query-row__source">{query.source}</span>
            <span>·</span>
            <span>{query.connection}</span>
            {duplicate ? (
              <span className="query-row__badge query-row__badge--error">
                Duplicate ×{repeats}
              </span>
            ) : null}
            {slow ? <span className="query-row__badge query-row__badge--warn">Slow</span> : null}
          </div>
        </div>

        <div className="query-row__timing">
          <span
            className="query-row__duration"
            style={slow ? { color: 'var(--warn-fg)', fontWeight: 600 } : undefined}
          >
            {query.durationMs.toFixed(1)} ms
          </span>
          <div className="query-row__track">
            <div
              className="query-row__bar"
              style={{
                left: `${((query.offsetMs / request.durationMs) * 100).toFixed(2)}%`,
                width: `${((query.durationMs / request.durationMs) * 100).toFixed(2)}%`,
                background: bar,
              }}
            />
          </div>
        </div>
      </div>

      {open ? <QueryDetail query={query} /> : null}
    </div>
  )
}
