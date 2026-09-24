import { useState } from 'react'
import { CollectorPlaceholder } from './collector-placeholder'
import { QueriesTab } from './queries-tab'
import { RequestHeader } from './request-header'
import { RequestList } from './request-list'
import { TabBar } from './tab-bar'
import { tabsFor, type TabKey } from './tabs'
import { useRequests } from './use-requests'

export function RequestsView() {
  const requests = useRequests()
  const [tab, setTab] = useState<TabKey>('queries')
  const selected = requests.selected

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
        {selected === null ? (
          <div className="request-detail-placeholder">Select a request</div>
        ) : (
          <>
            <div className="request-detail__head">
              <RequestHeader request={selected} />
              <TabBar active={tab} onSelect={setTab} tabs={tabsFor(selected)} />
            </div>

            <div className="request-detail__body">
              {tab === 'queries' ? (
                <QueriesTab key={selected.id} request={selected} />
              ) : (
                <CollectorPlaceholder
                  title={tabsFor(selected).find((entry) => entry.key === tab)?.label ?? ''}
                />
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}
