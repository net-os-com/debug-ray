import { useCallback, useMemo, useState } from 'react'
import { OUT_OF_STREAM, type RayEvent } from '../../shared/ray-event'
import { buildKindOptions, buildLabelOptions, buildSourceOptions } from './build-filters'
import { Sidebar } from './chrome/sidebar'
import { TitleRail } from './chrome/title-rail'
import { Toolbar } from './chrome/toolbar'
import { UpdateBanner } from './chrome/update-banner'
import type { View } from './chrome/view-nav'
import { DetailPanel } from './detail/detail-panel'
import { usePanelWidth } from './detail/use-panel-width'
import { ALL, filterEvents, type Filters } from './filter-events'
import { SettingsProvider } from './settings-context'
import { notificationFor } from './notification-text'
import { ApiView } from './api/api-view'
import { useApi } from './api/use-api'
import { RequestsView } from './requests/requests-view'
import { useRequests } from './requests/use-requests'
import { SettingsView } from './settings/settings-view'
import { TinkerView } from './tinker/tinker-view'
import { useSnippets } from './tinker/use-snippets'
import { useTinker } from './tinker/use-tinker'
import { ToolsView, type ToolKey } from './tools/tools-view'
import { useArtisan } from './tools/use-artisan'
import { useLogs } from './tools/use-logs'
import { useQueues } from './tools/use-queues'
import { useSchema } from './tools/use-schema'
import { useScout } from './tools/use-scout'
import { useTests } from './tools/use-tests'
import { ConfettiOverlay } from './stream/confetti-overlay'
import { EmptyState } from './stream/empty-state'
import { EventStream } from './stream/event-stream'
import { NoResults } from './stream/no-results'
import { useAlwaysOnTop } from './use-always-on-top'
import { useRayEvents } from './use-ray-events'
import { useServerStatus } from './use-server-status'
import { useFindShortcut } from './use-find-shortcut'
import { useSettings } from './use-settings'
import { useTheme } from './use-theme'
import { useUpdate } from './use-update'

const NO_FILTERS: Filters = { source: ALL, kind: ALL, label: ALL, query: '' }

export function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { settings, set: setSetting, toggle: toggleSetting } = useSettings()
  const status = useServerStatus()
  const panel = usePanelWidth()
  const update = useUpdate()
  const requests = useRequests({
    max: settings.requestBuffer,
    slowMs: settings.slowRequestMs,
    collect: settings.collectRequests,
  })
  const tinker = useTinker()
  const api = useApi(tinker.container)
  const snippets = useSnippets()
  const artisan = useArtisan(tinker.container)
  const logs = useLogs(tinker.container)
  const queues = useQueues(tinker.container)
  const schema = useSchema(tinker.container, tinker.tenants)
  const scout = useScout(tinker.container, tinker.tenants)
  const tests = useTests(tinker.container)
  const [tool, setTool] = useState<ToolKey>('artisan')

  useAlwaysOnTop(settings.alwaysOnTop)

  const [view, setView] = useState<View>(settings.defaultView)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  useFindShortcut(() => {
    if (view === 'stream') {
      return '[data-find="stream"]'
    }

    if (view === 'requests') {
      return '[data-find="requests"]'
    }

    if (view === 'tinker') {
      // There is nothing to search until a run returned a value, so the box
      // that is any use right now is the snippet list.
      return tinker.outcome?.kind === 'value' ? '[data-find="tinker-output"]' : '[data-find="snippets"]'
    }

    if (view === 'api') {
      return '[data-find="api"]'
    }

    if (view === 'tools' && tool === 'artisan') {
      return '[data-find="artisan"]'
    }

    if (view === 'tools' && tool === 'tests') {
      return '[data-find="tests"]'
    }

    if (view === 'tools' && tool === 'schema') {
      return '[data-find="schema"]'
    }

    return null
  })

  const onEvent = useCallback(
    (event: RayEvent) => {
      if (settings.notifyOnError && event.type === 'exception') {
        window.ray.requestAttention()
      }

      // onEvent sees every payload, including the collected requests and the
      // annotations that decorate another event, so the stream's own filter
      // applies here too.
      if (settings.notifyOnEvent && !OUT_OF_STREAM.has(event.type) && event.type !== 'clear_all') {
        const { title, body } = notificationFor(event)

        window.ray.notify(title, body)
      }
    },
    [settings.notifyOnError, settings.notifyOnEvent],
  )

  const { events, pendingCount, labels, colors, confettiAt, clear } = useRayEvents({
    maxEvents: settings.eventBuffer,
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
    <SettingsProvider settings={settings}>
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
          ) : view === 'api' ? (
            <ApiView
              api={api}
              // Only offered when the collector on the other side actually saw
              // this call; a link to nothing is worse than no link.
              onOpenInRequests={
                api.result !== null && requests.findByDebugId(api.result.debugId) !== null
                  ? (debugId) => {
                      const id = requests.findByDebugId(debugId)

                      if (id !== null) {
                        requests.setSelectedId(id)
                        setView('requests')
                      }
                    }
                  : null
              }
            />
          ) : view === 'tools' ? (
            <ToolsView
              artisan={artisan}
              logs={logs}
              onSelectTool={setTool}
              queues={queues}
              schema={schema}
              scout={scout}
              tenants={tinker.tenants}
              tests={tests}
              tool={tool}
            />
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
                    onSet={setSetting}
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
    </SettingsProvider>
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
