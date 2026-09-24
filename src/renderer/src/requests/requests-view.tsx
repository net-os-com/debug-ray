import { RequestList } from './request-list'
import { useRequests } from './use-requests'

export function RequestsView() {
  const requests = useRequests()

  return (
    <>
      <RequestList
        filter={requests.filter}
        onFilterChange={requests.setFilter}
        onQueryChange={requests.setQuery}
        onReset={requests.reset}
        onSelect={requests.setSelectedId}
        query={requests.query}
        requests={requests.shown}
        selectedId={requests.selectedId}
      />

      <section className="app__content">
        {/* The header, tabs and Queries screen land in the next phases. */}
        <div className="request-detail-placeholder">
          {requests.selected
            ? `${requests.selected.method} ${requests.selected.uri}`
            : 'Select a request'}
        </div>
      </section>
    </>
  )
}
