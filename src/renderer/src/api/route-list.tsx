import { useState } from 'react'
import type { ImportedFile } from '../../../shared/import/documents'
import type { AppRoute } from '../../../shared/tools'
import { Caret } from './caret'
import { CollectionTree } from './collection-tree'
import { ImportPanel } from './import-panel'
import { methodColor } from './method-color'
import type { ApiState } from './use-api'

/** The sidebar: what you can call, and what you have saved. */
export function RouteList({ api }: { api: ApiState }) {
  /** Route groups are many and start closed, so this is what has been opened. */
  const [open, setOpen] = useState<Set<string>>(new Set())
  /**
   * Collections, their folders and the two headings start open — they are yours
   * and there are few of them — so this is what has been shut.
   */
  const [shut, setShut] = useState<Set<string>>(new Set())

  const toggle = (prefix: string): void => setOpen((current) => flip(current, prefix))
  const close = (key: string): void => setShut((current) => flip(current, key))

  const routesOpen = !shut.has('routes')

  return (
    <aside className="api-side">
      <div className="api-side__head">
        <input
          className="api-side__search"
          data-find="api"
          onChange={(event) => api.setQuery(event.target.value)}
          placeholder="Search routes"
          value={api.query}
        />
        <button className="button" onClick={api.reset} title="New request" type="button">
          +
        </button>
      </div>

      <div className="api-side__body">
        <Collections api={api} onToggle={close} shut={shut} />

        <div className="api-side__label">
          <button className="api-side__section" onClick={() => close('routes')} type="button">
            <Caret open={routesOpen} />
            Routes
          </button>

          <button
            className={api.appOnly ? 'api-side__toggle api-side__toggle--on' : 'api-side__toggle'}
            onClick={() => api.setAppOnly(!api.appOnly)}
            title={
              api.appOnly
                ? `Showing the ${api.ours.length} routes this application registers, of ${api.routes.length}`
                : `Showing all ${api.routes.length} routes, packages included`
            }
            type="button"
          >
            {api.appOnly ? 'app only' : 'all'}
          </button>
        </div>

        {!routesOpen ? null : api.routes.length === 0 ? (
          <div className="api-side__empty">
            No routes yet. They are read from the container the app is pointed at.
          </div>
        ) : api.groups.length === 0 ? (
          <div className="api-side__empty">Nothing matches “{api.query}”</div>
        ) : (
          api.groups.map((group) => {
            // A search has already narrowed things down, so making you open
            // every group again to see what it found would undo the search.
            const expanded = open.has(group.prefix) || api.query.trim() !== ''

            return (
              <div key={group.prefix}>
                <button
                  className="api-side__group"
                  onClick={() => toggle(group.prefix)}
                  type="button"
                >
                  <Caret open={expanded} />
                  <span className="api-side__prefix">/{group.prefix}</span>
                  <span className="api-side__count">{group.routes.length}</span>
                </button>

                {expanded
                  ? group.routes.map((route) => (
                      <RouteRow
                        active={api.request.routeUri === route.uri}
                        key={`${route.methods.join()}:${route.uri}`}
                        onOpen={() => api.openRoute(route)}
                        route={route}
                      />
                    ))
                  : null}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

type CollectionsProps = {
  api: ApiState
  shut: Set<string>
  onToggle: (key: string) => void
}

/**
 * Requests saved into the repository, read back through the package that wrote
 * them. These are the ones somebody decided were worth keeping.
 */
function Collections({ api, shut, onToggle }: CollectionsProps) {
  const open = !shut.has('collections')
  /** What a picked file turned out to hold, while it waits to be written. */
  const [read, setRead] = useState<ImportedFile | null>(null)
  const [picking, setPicking] = useState(false)

  const pick = async (): Promise<void> => {
    setPicking(true)

    try {
      const picked = await window.ray.importFile()

      if (!picked.cancelled) {
        setRead(picked)
      }
    } finally {
      setPicking(false)
    }
  }

  return (
    <>
      <div className="api-side__label">
        <button className="api-side__section" onClick={() => onToggle('collections')} type="button">
          <Caret open={open} />
          Collections
        </button>

        {/*
          An OpenAPI or Swagger document, or an Insomnia collection: read here
          rather than in the container, because the file is on this machine.
        */}
        <button
          className="api-side__toggle"
          onClick={() => void pick()}
          title="Import an OpenAPI, Swagger or Insomnia v5 file"
          type="button"
        >
          {picking ? 'reading…' : 'import'}
        </button>

        {/*
          They are read when the app starts, which covers the person who saved
          them — but not the one who pulled them. Checking out a branch with
          somebody else's collection in it should not need a restart to see.
        */}
        <button
          className="api-side__toggle"
          onClick={() => void api.loadCollections()}
          title="Read the collection files again"
          type="button"
        >
          reload
        </button>
      </div>

      {read === null ? null : read.problem !== null ? (
        <div className="api-side__problem">
          {read.problem}
          <button className="api-side__dismiss" onClick={() => setRead(null)} type="button">
            Dismiss
          </button>
        </div>
      ) : read.requests.length === 0 ? (
        <div className="api-side__problem">
          That {read.format} document holds no requests.
          <button className="api-side__dismiss" onClick={() => setRead(null)} type="button">
            Dismiss
          </button>
        </div>
      ) : (
        <ImportPanel api={api} onDone={() => setRead(null)} read={read} />
      )}

      {/* A write that failed, said once, above the list it did not change. */}
      {open && api.writeError !== null ? (
        <div className="api-side__problem">{api.writeError}</div>
      ) : null}

      {!open ? null : api.collectionsError !== null ? (
        <div className="api-side__empty">{api.collectionsError}</div>
      ) : api.collections.length === 0 ? (
        <div className="api-side__empty">
          Empty. Open a request and use Save to add it here — it is written into the repository as
          OpenAPI, in whatever folder you give it.
        </div>
      ) : (
        api.collections.map((collection) => {
          const shown = !shut.has(collection.name)

          return (
            <div key={collection.name}>
              <button
                className="api-side__group"
                onClick={() => onToggle(collection.name)}
                title={collection.file}
                type="button"
              >
                <Caret open={shown} />
                <span className="api-side__prefix">{collection.name}</span>
                <span className="api-side__count">{collection.operations}</span>
              </button>

              {shown ? (
                <CollectionTree
                  api={api}
                  collection={collection.name}
                  onToggle={onToggle}
                  requests={api.saved[collection.name] ?? []}
                  shut={shut}
                />
              ) : null}
            </div>
          )
        })
      )}
    </>
  )
}

/** In or out of a set, without mutating the one React is holding. */
function flip(current: Set<string>, key: string): Set<string> {
  const next = new Set(current)

  if (!next.delete(key)) {
    next.add(key)
  }

  return next
}

type RouteRowProps = {
  route: AppRoute
  active: boolean
  onOpen: () => void
}

function RouteRow({ route, active, onOpen }: RouteRowProps) {
  const method = route.methods[0] ?? 'GET'

  return (
    <button
      className={active ? 'api-side__route api-side__route--on' : 'api-side__route'}
      onClick={onOpen}
      title={route.action}
      type="button"
    >
      <span className="api-side__method" style={{ color: methodColor(method) }}>
        {method}
      </span>
      <span className="api-side__uri">{route.name || route.uri}</span>
    </button>
  )
}
