import type { StreamOrder } from '../filter-events'
import { SearchField } from './search-field'

type ToolbarProps = {
  listening: boolean
  order: StreamOrder
  onOrder: (order: StreamOrder) => void
  paused: boolean
  pendingCount: number
  query: string
  summary: string
  onQueryChange: (value: string) => void
  onTogglePause: () => void
  onClear: () => void
}

export function Toolbar({
  listening,
  order,
  onOrder,
  paused,
  pendingCount,
  query,
  summary,
  onQueryChange,
  onTogglePause,
  onClear,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="live">
        <span className={paused || !listening ? 'live__dot live__dot--held' : 'live__dot'} />
        <span className="live__label">
          {!listening ? 'Not listening' : paused ? 'Paused' : 'Listening'}
        </span>
      </div>

      <SearchField onChange={onQueryChange} value={query} />

      <span className="toolbar__summary">{summary}</span>

      <div className="toolbar__actions">
        {/*
          In the toolbar and not only in Settings: this is something you flip
          while reading a trace, not something you set once. Settings keeps
          whichever way you left it as the one the app opens on.
        */}
        <button
          className="button"
          onClick={() => onOrder(order === 'newest' ? 'oldest' : 'newest')}
          title={
            order === 'newest'
              ? 'Newest first. Click for oldest first.'
              : 'Oldest first. Click for newest first.'
          }
          type="button"
        >
          <span className="button__glyph">{order === 'newest' ? '↓' : '↑'}</span>
          {order === 'newest' ? 'Newest' : 'Oldest'}
        </button>
        <button className="button" onClick={onTogglePause} type="button">
          <span className="button__glyph">{paused ? '▶' : '❙❙'}</span>
          {paused ? `Resume${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'Pause'}
        </button>
        <button className="button button--primary" onClick={onClear} type="button">
          Clear
        </button>
      </div>
    </div>
  )
}
