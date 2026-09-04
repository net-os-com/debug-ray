import { SearchField } from './search-field'

type ToolbarProps = {
  listening: boolean
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
