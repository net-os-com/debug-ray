import type { HttpRequest, RequestFilter } from './types'
import { RequestRow } from './request-row'
import { SearchIcon } from '../ui/icons'

const FILTERS: { key: RequestFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'errors', label: 'Errors' },
  { key: 'slow', label: 'Slow' },
  { key: 'n1', label: 'N+1' },
  { key: 'options', label: 'Options' },
]

type RequestListProps = {
  requests: HttpRequest[]
  /** Before filtering, so an empty list can say which kind of empty it is. */
  total: number
  /** Preflights are hidden outside their own filter; offer them a way back. */
  preflightCount: number
  selectedId: string | null
  query: string
  filter: RequestFilter
  onQueryChange: (query: string) => void
  onFilterChange: (filter: RequestFilter) => void
  onSelect: (id: string) => void
  onReset: () => void
  onClear: () => void
}

export function RequestList({
  requests,
  total,
  preflightCount,
  selectedId,
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onSelect,
  onReset,
  onClear,
}: RequestListProps) {
  return (
    <aside className="request-list">
      <div className="request-list__head">
        <div className="request-list__search">
          <div className="search">
            <SearchIcon />
            <input
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Filter requests"
              value={query}
            />
          </div>
          <button
            className="button"
            disabled={total === 0}
            onClick={onClear}
            title="Discard every collected request"
            type="button"
          >
            Clear
          </button>
        </div>
        <div className="request-list__filters">
          {FILTERS.map((option) => (
            <button
              className={
                option.key === filter ? 'label-pill label-pill--active' : 'label-pill'
              }
              key={option.key}
              onClick={() => onFilterChange(option.key)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="request-list__body">
        {total === 0 ? (
          <div className="request-list__empty">
            <div>No requests collected yet.</div>
          </div>
        ) : requests.length === 0 ? (
          <div className="request-list__empty">
            {filter !== 'options' && preflightCount === total ? (
              <div>
                Only CORS preflights collected. They live behind the Options filter.
              </div>
            ) : (
              <>
                <div>No requests match these filters.</div>
                <button className="button" onClick={onReset} type="button">
                  Reset filters
                </button>
              </>
            )}
          </div>
        ) : (
          requests.map((request) => (
            <RequestRow
              key={request.id}
              onSelect={() => onSelect(request.id)}
              request={request}
              selected={request.id === selectedId}
            />
          ))
        )}
      </div>
    </aside>
  )
}
