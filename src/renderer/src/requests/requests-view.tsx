import { useState } from 'react'
import { CollectorPlaceholder } from './collector-placeholder'
import { QueriesTab } from './queries-tab'
import { RequestHeader } from './request-header'
import { RequestList } from './request-list'
import { CacheTab } from './cache-tab'
import { EventsTab } from './events-tab'
import { RequestTab } from './request-tab'
import { RouteTab } from './route-tab'
import { TabBar } from './tab-bar'
import { TimelineTab } from './timeline-tab'
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
        onClear={requests.clear}
        preflightCount={requests.preflightCount}
        onFilterChange={requests.setFilter}
        onQueryChange={requests.setQuery}
        onReset={requests.reset}
        onSelect={requests.setSelectedId}
        query={requests.query}
        requests={requests.shown}
        selectedId={requests.selectedId}
        total={requests.total}
      />

      <section className="app__content">
        {selected === null ? (
          <div className="request-detail-placeholder">
            {requests.total === 0
              ? 'Waiting for requests. Hit your app and they show up here.'
              : 'Select a request'}
          </div>
        ) : (
          <>
            <div className="request-detail__head">
              <RequestHeader request={selected} />
              <TabBar active={tab} onSelect={setTab} tabs={tabsFor(selected)} />
            </div>

            <div className="request-detail__body">
              {tab === 'queries' ? (
                <QueriesTab key={selected.id} request={selected} />
              ) : tab === 'timeline' ? (
                <TimelineTab key={selected.id} request={selected} />
              ) : tab === 'route' ? (
                <RouteTab key={selected.id} request={selected} />
              ) : tab === 'events' ? (
                <EventsTab key={selected.id} request={selected} />
              ) : tab === 'cache' ? (
                <CacheTab key={selected.id} request={selected} />
              ) : tab === 'request' ? (
                <RequestTab key={selected.id} request={selected} />
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
