import { useMemo, useState } from 'react'
import { CopyButton } from '../ui/copy-button'
import { NPlusOneBanner } from './n-plus-one-banner'
import { QueryRow } from './query-row'
import { QueryStats } from './query-stats'
import { fillBindings } from './sql-tokens'
import { duplicateQueries, repeatCount, SLOW_QUERY_MS, type HttpRequest } from './types'

type QueryFilter = 'all' | 'duplicates' | 'slow'
type QuerySort = 'order' | 'slowest'

export function QueriesTab({ request }: { request: HttpRequest }) {
  const [filter, setFilter] = useState<QueryFilter>('all')
  const [sort, setSort] = useState<QuerySort>('order')
  const [withBindings, setWithBindings] = useState(true)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const duplicates = duplicateQueries(request)
  const slow = request.queries.filter((query) => query.durationMs >= SLOW_QUERY_MS)

  // Indexes are kept so the numbering keeps matching the order they ran in.
  const rows = useMemo(() => {
    const all = request.queries.map((query, index) => ({ query, index }))

    const filtered = all.filter(({ query }) => {
      if (filter === 'duplicates') {
        return repeatCount(request, query) > 1
      }

      if (filter === 'slow') {
        return query.durationMs >= SLOW_QUERY_MS
      }

      return true
    })

    return sort === 'slowest'
      ? [...filtered].sort((a, b) => b.query.durationMs - a.query.durationMs)
      : filtered
  }, [request, filter, sort])

  const allSql = request.queries
    .map((query) => `${fillBindings(query.sql, query.bindings)};`)
    .join('\n')

  return (
    <div className="queries-tab">
      <QueryStats request={request} />

      {filter === 'duplicates' ? null : (
        <NPlusOneBanner onShowDuplicates={() => setFilter('duplicates')} request={request} />
      )}

      <div className="queries-tab__controls">
        <div className="segmented">
          {(
            [
              ['all', `All ${request.queries.length}`],
              ['duplicates', `Duplicates ${duplicates.length}`],
              ['slow', `Slow ${slow.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              className={filter === key ? 'segmented__item segmented__item--active' : 'segmented__item'}
              key={key}
              onClick={() => setFilter(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="segmented">
          {(
            [
              ['order', 'In order'],
              ['slowest', 'Slowest first'],
            ] as const
          ).map(([key, label]) => (
            <button
              className={sort === key ? 'segmented__item segmented__item--active' : 'segmented__item'}
              key={key}
              onClick={() => setSort(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className="bindings-toggle"
          onClick={() => setWithBindings((current) => !current)}
          type="button"
        >
          <span className={withBindings ? 'switch switch--on' : 'switch'}>
            <span className="switch__knob" />
          </span>
          Fill in bindings
        </button>

        <div className="queries-tab__copy">
          <CopyButton label="Copy all as SQL" text={allSql} />
        </div>
      </div>

      <div className="query-list">
        {rows.length === 0 ? (
          <div className="query-list__empty">No queries match this filter.</div>
        ) : (
          rows.map(({ query, index }) => (
            <QueryRow
              index={index}
              key={index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              open={openIndex === index}
              query={query}
              repeats={repeatCount(request, query)}
              request={request}
              withBindings={withBindings}
            />
          ))
        )}
      </div>
    </div>
  )
}
