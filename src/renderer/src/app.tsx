import { useCallback, useMemo, useState } from 'react'
import type { RayEvent } from '../../shared/ray-event'
import { buildKindOptions, buildLabelOptions, buildSourceOptions } from './build-filters'
import { Sidebar } from './chrome/sidebar'
import { TitleRail } from './chrome/title-rail'
import { Toolbar } from './chrome/toolbar'
import { UpdateBanner } from './chrome/update-banner'
import type { View } from './chrome/view-nav'
import { DetailPanel } from './detail/detail-panel'
import { usePanelWidth } from './detail/use-panel-width'
import { ALL, filterEvents, type Filters } from './filter-events'
import { RequestsView } from './requests/requests-view'
import { useRequests } from './requests/use-requests'
import { SettingsView } from './settings/settings-view'
import { TinkerView } from './tinker/tinker-view'
import { useSnippets } from './tinker/use-snippets'
import { useTinker } from './tinker/use-tinker'
import { ConfettiOverlay } from './stream/confetti-overlay'
import { EmptyState } from './stream/empty-state'
import { EventStream } from './stream/event-stream'
import { NoResults } from './stream/no-results'
import { useAlwaysOnTop } from './use-always-on-top'
import { useRayEvents } from './use-ray-events'
import { useServerStatus } from './use-server-status'
import { useSettings } from './use-settings'
import { useTheme } from './use-theme'
import { useUpdate } from './use-update'

const NO_FILTERS: Filters = { source: ALL, kind: ALL, label: ALL, query: '' }

export function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { settings, toggle: toggleSetting } = useSettings()
  const status = useServerStatus()
  const panel = usePanelWidth()
  const update = useUpdate()
  const requests = useRequests()
  const tinker = useTinker()
  const snippets = useSnippets()

  useAlwaysOnTop(settings.alwaysOnTop)

  const [view, setView] = useState<View>('stream')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  const onEvent = useCallback(
    (event: RayEvent) => {
      if (settings.notifyOnError && event.type === 'exception') {
        window.ray.requestAttention()
      }
    },
    [settings.notifyOnError],
  )

  const { events, pendingCount, labels, colors, confettiAt, clear } = useRayEvents({
    paused,
    onEvent,
  })

  const shown = useMemo(() => filterEvents(events, filters, labels), [events, filters, labels])
  const selected = shown.find((event) => event.id === selectedId) ?? null

  const sources = useMemo(() => buildSourceOptions(events), [events])
  const kinds = useMemo(() => buildKindOptions(events), [events])
  const labelOptions = useMemo(() => buildLabelOptions(events, labels, colors), [events, labels, colors])

  const target = status ? `${status.host}:${status.port}` : 'starting…'
  const project = firstProject(events)

  return (
    <div className="app" data-app={theme}>
      <TitleRail
        onOpenSettings={() => setView('settings')}
        onSelectView={setView}
        onToggleTheme={toggleTheme}
        subtitle={project ? `${project} · ${target}` : target}
        theme={theme}
        view={view}
      />

      <UpdateBanner status={update} />

      <div className="app__main">

        {view === 'requests' ? (
          <RequestsView requests={requests} />
        ) : view === 'tinker' ? (
          <TinkerView snippets={snippets} tinker={tinker} />
        ) : (
          <>
            <Sidebar
              active={filters}
              kinds={kinds}
              labels={labelOptions}
              onOpenSettings={() => setView('settings')}
              onSelect={(group, key) => {
                setFilters((current) => ({ ...current, [group]: key }))
                // Filtering is about the stream, so picking one leaves settings.
                setView('stream')
              }}
              sources={sources}
              total={events.length}
            />

            <section className="app__content">
              {view === 'settings' ? (
                <SettingsView
                  onClose={() => setView('stream')}
                  onToggle={toggleSetting}
                  settings={settings}
                  status={status}
                />
              ) : (
                <>
                  <Toolbar
                    listening={status?.listening ?? false}
                    onClear={clear}
                    onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
                    onTogglePause={() => setPaused((current) => !current)}
                    paused={paused}
                    pendingCount={pendingCount}
                    query={filters.query}
                    summary={`${shown.length} of ${events.length} events`}
                  />

                  <div className="app__stream">
                    {events.length === 0 ? (
                      <EmptyState target={target} />
                    ) : shown.length === 0 ? (
                      <NoResults onReset={() => setFilters(NO_FILTERS)} query={filters.query} />
                    ) : (
                      <EventStream
                        autoscroll={settings.autoscroll && !paused}
                        colors={colors}
                        events={shown}
                        labels={labels}
                        onSelect={setSelectedId}
                        selectedId={selectedId}
                      />
                    )}

                    {selected ? (
                      <DetailPanel
                        event={selected}
                        hideVendorFrames={settings.hideVendorFrames}
                        onClose={() => setSelectedId(null)}
                        onResetWidth={panel.reset}
                        onResize={panel.resize}
                        width={panel.width}
                      />
                    ) : null}
                  </div>
              </>
            )}
          </section>
          </>
        )}
      </div>

      <ConfettiOverlay trigger={confettiAt} />
    </div>
  )
}

function firstProject(events: RayEvent[]): string | null {
  for (const event of events) {
    if (typeof event.meta.project_name === 'string' && event.meta.project_name) {
      return event.meta.project_name
    }
  }

  return null
}
