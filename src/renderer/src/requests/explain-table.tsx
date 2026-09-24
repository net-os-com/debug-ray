const COLUMNS = ['id', 'select', 'table', 'access', 'key', 'rows', 'filtered', 'extra']

/** A full scan or a filesort is the thing you are looking for here. */
function cellColor(column: number, value: string): string {
  const scan = column === 3 && value === 'ALL'
  const filesort = column === 7 && /filesort/i.test(value)

  return scan || filesort ? 'var(--warn-fg)' : 'var(--t2)'
}

type ExplainTableProps = {
  rows: string[][] | null
  hint: string | null
}

export function ExplainTable({ rows, hint }: ExplainTableProps) {
  if (rows === null) {
    return (
      <div className="query-detail__none">
        No EXPLAIN was captured for this query.
      </div>
    )
  }

  return (
    <>
      <div className="explain">
        <div className="explain__grid explain__head">
          {COLUMNS.map((column) => (
            <div key={column}>{column}</div>
          ))}
        </div>
        {rows.map((row, index) => (
          <div className="explain__grid" key={index}>
            {row.map((value, column) => (
              <div key={column} style={{ color: cellColor(column, value) }}>
                {value || '—'}
              </div>
            ))}
          </div>
        ))}
      </div>
      {hint ? <div className="explain__hint">{hint}</div> : null}
    </>
  )
}
