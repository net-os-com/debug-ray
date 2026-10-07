import { useState } from 'react'
import type { AppRoute } from '../../../shared/tools'
import { methodColor } from './method-color'
import type { ApiState } from './use-api'

/** The sidebar: what you can call, and what you have saved. */
export function RouteList({ api }: { api: ApiState }) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  const toggle = (prefix: string): void =>
    setOpen((current) => {
      const next = new Set(current)

      if (!next.delete(prefix)) {
        next.add(prefix)
      }

      return next
    })

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
        <Collections api={api} />

        <div className="api-side__label">
          Routes
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

        {api.routes.length === 0 ? (
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
                <button className="api-side__group" onClick={() => toggle(group.prefix)} type="button">
                  <span className="api-side__caret">{expanded ? '▾' : '▸'}</span>
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

/**
 * Requests saved into the repository, read back through the package that wrote
 * them. These are the ones somebody decided were worth keeping.
 */
function Collections({ api }: { api: ApiState }) {
  if (api.collectionsError !== null) {
    return (
      <>
        <div className="api-side__label">Collections</div>
        <div className="api-side__empty">{api.collectionsError}</div>
      </>
    )
  }

  if (api.collections.length === 0) {
    return (
      <>
        <div className="api-side__label">Collections</div>
        <div className="api-side__empty">
          Empty. Open a request and use Save to add it here — it is written into the repository as
          OpenAPI.
        </div>
      </>
    )
  }

  return (
    <>
      <div className="api-side__label">Collections</div>

      {api.collections.map((collection) => (
        <div key={collection.name}>
          <div className="api-side__group" title={collection.file}>
            <span className="api-side__caret">▾</span>
            <span className="api-side__prefix">{collection.name}</span>
            <span className="api-side__count">{collection.operations}</span>
          </div>

          {(api.saved[collection.name] ?? []).map((one) => (
            <div className="api-side__saved" key={one.operationId ?? one.name}>
              <button
                className="api-side__route"
                onClick={() => api.openSaved(one)}
                title={`${one.method} ${one.path}`}
                type="button"
              >
                <span className="api-side__method" style={{ color: methodColor(one.method) }}>
                  {one.method}
                </span>
                <span className="api-side__uri">{one.name}</span>
              </button>

              <button
                className="api-side__forget"
                onClick={() => void api.forgetSaved(collection.name, one.operationId ?? '')}
                title="Remove from this collection"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ))}
    </>
  )
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
