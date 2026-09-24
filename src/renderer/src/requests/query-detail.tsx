import { CopyButton } from '../ui/copy-button'
import { BindingsList } from './bindings-list'
import { ExplainTable } from './explain-table'
import { QueryTrace } from './query-trace'
import { fillBindings } from './sql-tokens'
import type { Query } from './types'

export function QueryDetail({ query }: { query: Query }) {
  return (
    <div className="query-detail">
      <div className="query-detail__actions">
        <CopyButton label="Copy as SQL" text={`${fillBindings(query.sql, query.bindings)};`} />
        <button
          className="button"
          disabled
          title="Opening a file needs absolute paths from a collector; that comes later."
          type="button"
        >
          Open in editor
        </button>
      </div>

      <div>
        <div className="query-detail__label">Bindings</div>
        <BindingsList bindings={query.bindings} />
      </div>

      <div>
        <div className="query-detail__label">Explain</div>
        <ExplainTable hint={query.hint} rows={query.explain} />
      </div>

      <div>
        <div className="query-detail__label">Backtrace</div>
        <QueryTrace frames={query.trace} />
      </div>
    </div>
  )
}
