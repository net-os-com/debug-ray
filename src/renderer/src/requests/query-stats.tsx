import { duplicateQueries, SLOW_QUERY_MS, type HttpRequest } from './types'

export function QueryStats({ request }: { request: HttpRequest }) {
  const totalMs = request.queries.reduce((sum, query) => sum + query.durationMs, 0)
  const duplicates = duplicateQueries(request)
  const slow = request.queries.filter((query) => query.durationMs >= SLOW_QUERY_MS)
  const statements = new Set(duplicates.map((query) => query.sql)).size

  const cards = [
    { label: 'Queries', value: String(request.queries.length), unit: '', alert: false },
    {
      label: 'Time in database',
      value: `${totalMs.toFixed(1)} ms`,
      unit: `${Math.round((totalMs / request.durationMs) * 100)}% of request`,
      alert: false,
    },
    {
      label: 'Duplicates',
      value: String(duplicates.length),
      unit: statements === 1 ? '1 statement' : `${statements} statements`,
      alert: duplicates.length > 0,
      tone: 'error' as const,
    },
    {
      label: 'Slow queries',
      value: String(slow.length),
      unit: `≥ ${SLOW_QUERY_MS} ms`,
      alert: slow.length > 0,
      tone: 'warn' as const,
    },
  ]

  return (
    <div className="query-stats">
      {cards.map((card) => (
        <div className="stat-card" key={card.label}>
          <div className="stat-card__label">{card.label}</div>
          <div
            className="stat-card__value"
            style={
              card.alert
                ? { color: card.tone === 'error' ? 'var(--err-fg)' : 'var(--warn-fg)' }
                : undefined
            }
          >
            {card.value}
          </div>
          <div className="stat-card__unit">{card.unit}</div>
        </div>
      ))}
    </div>
  )
}
