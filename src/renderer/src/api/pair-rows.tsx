import type { ApiPair } from '../../../shared/api'

type PairRowsProps = {
  pairs: ApiPair[]
  onChange: (pairs: ApiPair[]) => void
  keyPlaceholder: string
  valuePlaceholder: string
  /** Path parameters come from the route, so their names are not yours to edit. */
  lockKeys?: boolean
  empty: string
}

/**
 * The key/value editor every tab uses.
 *
 * There is always one blank row at the end and typing in it adds the next, so
 * adding a header is typing rather than pressing Add and then typing.
 */
export function PairRows({
  pairs,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  lockKeys = false,
  empty,
}: PairRowsProps) {
  if (lockKeys && pairs.length === 0) {
    return <div className="api-pairs__empty">{empty}</div>
  }

  const rows = lockKeys ? pairs : [...pairs, { key: '', value: '', enabled: true }]

  const write = (index: number, change: Partial<ApiPair>): void => {
    const next = rows.map((row, at) => (at === index ? { ...row, ...change } : row))

    // The trailing blank only becomes a row once it has something in it.
    onChange(next.filter((row, at) => at < pairs.length || row.key !== '' || row.value !== ''))
  }

  return (
    <div className="api-pairs">
      {rows.map((pair, index) => (
        <div className="api-pairs__row" key={index}>
          {lockKeys ? null : (
            <input
              checked={pair.enabled}
              className="api-pairs__check"
              onChange={(event) => write(index, { enabled: event.target.checked })}
              type="checkbox"
            />
          )}

          {lockKeys ? (
            <span className="api-pairs__locked">{pair.key}</span>
          ) : (
            <input
              className="api-pairs__key"
              onChange={(event) => write(index, { key: event.target.value })}
              placeholder={keyPlaceholder}
              value={pair.key}
            />
          )}

          <input
            className="api-pairs__value"
            onChange={(event) => write(index, { value: event.target.value })}
            placeholder={valuePlaceholder}
            value={pair.value}
          />

          {lockKeys || index >= pairs.length ? (
            <span className="api-pairs__spacer" />
          ) : (
            <button
              className="api-pairs__remove"
              onClick={() => onChange(pairs.filter((_, at) => at !== index))}
              title="Remove"
              type="button"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
