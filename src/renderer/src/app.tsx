import { useCallback, useMemo, useState } from 'react'
import { OUT_OF_STREAM, type RayEvent } from '../../shared/ray-event'
import { buildKindOptions, buildLabelOptions, buildSourceOptions } from './build-filters'
import { ModuleHeader } from './chrome/module-header'
import { NavRail } from './chrome/nav-rail'
import { Sidebar } from './chrome/sidebar'
import { Toolbar } from './chrome/toolbar'
import { UpdateBanner } from './chrome/update-banner'
import type { View } from './chrome/view-nav'
import { ChangelogModal } from './changelog/changelog-modal'
import { LATEST } from './changelog/entries'
import { buildCommands } from './palette/commands'
import { CommandPalette } from './palette/command-palette'
import { usePalette } from './palette/use-palette'
import { DetailPanel } from './detail/detail-panel'
import { usePanelWidth } from './detail/use-panel-width'
import { ALL, filterEvents, type Filters } from './filter-events'
import { SettingsProvider } from './settings-context'
import { notificationFor } from './notification-text'
import { ApiView } from './api/api-view'
import { useApi, type ApiActor } from './api/use-api'
import { HttpView } from './http-client/http-view'
import { useHttpClient } from './http-client/use-http-client'
import { ErdView } from './erd/erd-view'
import { useErd } from './erd/use-erd'
import { RealtimeView } from './realtime/realtime-view'
import { useRealtime } from './realtime/use-realtime'
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

/** The version this build is, read once: it cannot change while it runs. */
const APP_VERSION = window.ray.appVersion()

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
  // Outgoing calls arrive whatever view is open, for the same reason collected
  // requests do: the one worth seeing goes out while you are looking elsewhere.
  const httpClient = useHttpClient({
    max: settings.httpClientBuffer,
    collect: settings.collectHttpClient,
  })
  const tinker = useTinker(settings.container)
  const api = useApi(
    tinker.container,
    // Who the API tab sends as, kept in settings so it survives both the next
    // request and the next launch.
    useMemo(
      () => ({
        mode: settings.apiAuthMode,
        variable: settings.apiAuthVariable,
        userId: settings.apiActorId,
        userLabel: settings.apiActorLabel,
      }),
      // Read once, to seed the tab; it is written from there afterwards, and
      // re-seeding on every write would fight whatever is being chosen.
      [],
    ),
    useCallback(
      (actor: ApiActor) => {
        setSetting('apiAuthMode', actor.mode)
        setSetting('apiAuthVariable', actor.variable)
        setSetting('apiActorId', actor.userId)
        setSetting('apiActorLabel', actor.userLabel)
      },
      [setSetting],
    ),
  )
  const snippets = useSnippets()
  const artisan = useArtisan(tinker.container)
  const logs = useLogs(tinker.container)
  const queues = useQueues(tinker.container)
  const schema = useSchema(
    tinker.container,
    tinker.tenants,
    { tenant: settings.erdTenant, chosen: settings.erdTenantChosen },
    useCallback(
      (next: string) => {
        setSetting('erdTenant', next)
        setSetting('erdTenantChosen', true)
      },
      [setSetting],
    ),
  )
  // Fed by the same schema the Tools view reads, so a tenant picked in one
  // place cannot leave the other showing a different database.
  const erd = useErd(
    tinker.container,
    schema.tables,
    schema.tenant,
    tinker.containersRead,
    settings.erdAutoSave,
  )
  const scout = useScout(tinker.container, tinker.tenants)
  const tests = useTests(tinker.container)
  const [tool, setTool] = useState<ToolKey>('artisan')

  useAlwaysOnTop(settings.alwaysOnTop)

  const [view, setView] = useState<View>(settings.defaultView)
  const [changelogOpen, setChangelogOpen] = useState(false)

  // Handed the same environment the API view sends with, so the token it mints
  // and the channel it authorizes belong to one tenant and one user. Declared
  // after `view` because it is told whether it is the view on screen.
  const realtime = useRealtime(
    tinker.container,
    api.environment ?? null,
    { key: settings.realtimeKey, cluster: settings.realtimeCluster },
    view === 'realtime',
  )
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
      return tinker.outcome?.kind === 'value'
        ? '[data-find="tinker-output"]'
        : '[data-find="snippets"]'
    }

    if (view === 'api') {
      return '[data-find="api"]'
    }

    if (view === 'http') {
      return '[data-find="http"]'
    }

    if (view === 'realtime') {
      return '[data-find="realtime"]'
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

  const shown = useMemo(
    () => filterEvents(events, filters, labels, settings.streamOrder),
    [events, filters, labels, settings.streamOrder],
  )
  const selected = shown.find((event) => event.id === selectedId) ?? null

  const sources = useMemo(() => buildSourceOptions(events), [events])
  const kinds = useMemo(() => buildKindOptions(events), [events])
  const labelOptions = useMemo(
    () => buildLabelOptions(events, labels, colors),
    [events, labels, colors],
  )

  const palette = usePalette(setView)

  /**
   * What the palette offers, rebuilt as the app changes.
   *
   * Everything in it comes from state this component already holds, so the
   * palette never reaches into a view — it is handed the few things each view
   * can do and knows nothing else about them.
   */
  const commands = useMemo(
    () =>
      buildCommands({
        onSelectView: setView,
        snippets: snippets.all.map((one) => ({
          id: one.id,
          name: one.name,
          open: () => {
            snippets.select(one.id)
            setView('tinker')
          },
        })),
        requests: Object.entries(api.saved).flatMap(([collection, list]) =>
          list.map((one) => ({
            id: `${collection}:${one.method} ${one.path}`,
            name: one.name,
            method: one.method,
            path: one.path,
            collection,
            folder: one.folder,
            open: () => {
              api.openSaved(one, collection)
              setView('api')
            },
          })),
        ),
        tables: erd.model.tables.map((one) => ({
          name: one.name,
          open: () => {
            erd.setSelected(one.name)
            setView('erd')
          },
        })),
        actions: [
          {
            id: 'clear-stream',
            label: 'Clear stream',
            where: 'Stream',
            key: '⌘⌫',
            run: () => {
              clear()
              setView('stream')
            },
          },
          {
            id: 'pause-stream',
            label: paused ? 'Resume the stream' : 'Pause the stream',
            where: 'Stream',
            run: () => {
              setPaused((current) => !current)
              setView('stream')
            },
          },
          {
            id: 'erd-save',
            label: 'Save schema.dbml',
            where: 'ERD',
            run: () => {
              setView('erd')
              void erd.save()
            },
          },
          {
            id: 'erd-arrange',
            label: 'Auto-arrange the diagram',
            where: 'ERD',
            run: () => {
              setView('erd')
              erd.rearrange()
            },
          },
          {
            id: 'erd-mysql',
            label: 'Import the schema from MySQL',
            where: 'ERD',
            run: () => {
              setView('erd')
              erd.importFromMySql()
              void schema.loadTables()
            },
          },
          {
            id: 'erd-migrations',
            label: 'Import the schema from migrations',
            where: 'ERD',
            run: () => {
              setView('erd')
              void erd.importFromMigrations()
            },
          },
          {
            id: 'realtime-pause',
            label: realtime.paused ? 'Resume realtime messages' : 'Pause realtime messages',
            where: 'Realtime',
            run: () => {
              setView('realtime')
              realtime.setPaused(!realtime.paused)
            },
          },
          {
            id: 'realtime-clear',
            label: 'Clear realtime messages',
            where: 'Realtime',
            run: () => {
              setView('realtime')
              realtime.clear()
            },
          },
          {
            id: 'settings',
            label: 'Open settings',
            where: 'App',
            run: () => setView('settings'),
          },
          {
            id: 'theme',
            label: theme === 'light' ? 'Switch to dark' : 'Switch to light',
            where: 'App',
            run: () => toggleTheme(false),
          },
        ],
      }),
    [snippets, api, erd, schema, clear, paused, realtime, theme, toggleTheme],
  )

  const target = status ? `${status.host}:${status.port}` : 'starting…'
  const project = firstProject(events)

  return (
    <SettingsProvider settings={settings}>
      <div className="app" data-app={theme}>
        <NavRail
          onOpenChangelog={() => {
            setChangelogOpen(true)

            if (LATEST !== null) {
              setSetting('changelogSeen', LATEST)
            }
          }}
          onOpenSettings={() => setView('settings')}
          onSelect={setView}
          unread={LATEST !== null && settings.changelogSeen !== LATEST}
          view={view}
        />

        <div className="app__body">
          <ModuleHeader
            listening={status?.listening ?? false}
            onOpenPalette={palette.show}
            subtitle={project ? `${project} · ${target}` : target}
            view={view}
          />

          <UpdateBanner status={update} />

          <div className="app__main">
            {view === 'requests' ? (
              <RequestsView requests={requests} />
            ) : view === 'http' ? (
              <HttpView http={httpClient} />
            ) : view === 'realtime' ? (
              <RealtimeView realtime={realtime} />
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
            ) : view === 'erd' ? (
              <ErdView
                erd={erd}
                loading={schema.loading}
                onImport={() => {
                  erd.importFromMySql()
                  void schema.loadTables()
                }}
                // Only the tenant is set here: loadTables closes over the tenant
                // it was created with, so calling it in the same tick would read
                // the database you just switched away from. setTenant clears the
                // tables, which puts the view back on its own import button.
                onTenant={schema.setTenant}
                // The inspector's two links lead out of the ERD: a model into
                // Tinker, and the table's name into the Requests search. Both go
                // through the views that already own those, rather than the ERD
                // growing a second way to run code or read queries.
                onRequests={(table) => {
                  requests.setQuery(table)
                  setView('requests')
                }}
                onTinker={(snippet) => {
                  snippets.setCode(snippet)
                  setView('tinker')
                }}
                tenant={schema.tenant}
                tenants={tinker.tenants}
              />
            ) : view === 'settings' ? (
              // Its own page, not a pane beside the stream's filters. Those
              // filters belong to the stream and could only confuse here — and
              // a page you reach from the rail does not need a way back out.
              <SettingsView
                containers={tinker.containers}
                onSet={setSetting}
                onToggle={toggleSetting}
                onToggleTheme={toggleTheme}
                settings={settings}
                status={status}
                theme={theme}
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
                  <Toolbar
                    listening={status?.listening ?? false}
                    onClear={clear}
                    onOrder={(order) => setSetting('streamOrder', order)}
                    order={settings.streamOrder}
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
                        order={settings.streamOrder}
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
                </section>
              </>
            )}
          </div>
        </div>

        {palette.open ? <CommandPalette groups={commands} onClose={palette.hide} /> : null}

        {changelogOpen ? (
          <ChangelogModal current={APP_VERSION} onClose={() => setChangelogOpen(false)} />
        ) : null}

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
