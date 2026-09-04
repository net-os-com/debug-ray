type NoResultsProps = {
  query: string
  onReset: () => void
}

export function NoResults({ query, onReset }: NoResultsProps) {
  return (
    <div className="no-results">
      <div className="no-results__title">
        {query ? `No events match “${query}”` : 'No events match these filters'}
      </div>
      <div className="no-results__body">
        Try a different term, or reset the source and type filters.
      </div>
      <button className="button" onClick={onReset} type="button">
        Reset filters
      </button>
    </div>
  )
}
