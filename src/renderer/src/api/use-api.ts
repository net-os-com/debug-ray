import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ApiEnvironment,
  CollectionSummary,
  SavedRequest,
  ApiPair,
  ApiRequest,
  ApiResult,
  MintedToken,
} from '../../../shared/api'
import type { TinkerContainer } from '../../../shared/tinker'
import type { AppRoute, RouteContext } from '../../../shared/tools'
import { buildUrl, resolve } from '../../../shared/resolve'
import { bodySkeleton } from './body-skeleton'
import { pathParamNames } from './url-tokens'

export type ApiState = ReturnType<typeof useApi>

export type RequestTab = 'params' | 'headers' | 'body' | 'auth'

const SEND_TIMEOUT_MS = 60_000

/**
 * What every request carries here unless it says otherwise.
 *
 * Tenancy on this API is identified by a header rather than by the domain, so
 * without X-Tenant every call answers "tenant could not be identified" — which
 * is a confusing first experience for a tool whose whole job is to make a call
 * succeed. The tenant itself is a variable, so switching environments switches
 * it.
 */
const DEFAULT_HEADERS: ApiPair[] = [
  { key: 'Accept', value: 'application/json', enabled: true },
  { key: 'X-Tenant', value: '{{ tenant }}', enabled: true },
]

export function blankRequest(): ApiRequest {
  return {
    id: `req-${Date.now().toString(36)}`,
    name: 'Untitled request',
    method: 'GET',
    path: '/',
    pathParams: [],
    query: [],
    headers: DEFAULT_HEADERS.map((header) => ({ ...header })),
    bodyMode: 'none',
    json: '',
    form: [],
    auth: { mode: 'none', variable: 'token', userId: '', userLabel: '' },
    routeUri: '',
  }
}

export function useApi(container: TinkerContainer | null) {
  const [environments, setEnvironments] = useState<ApiEnvironment[]>(() =>
    window.ray.readEnvironments(),
  )
  const [environmentId, setEnvironmentId] = useState(() => environments[0]?.id ?? '')
  const [routes, setRoutes] = useState<AppRoute[]>([])
  const [contexts, setContexts] = useState<RouteContext[]>([])
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [saved, setSaved] = useState<Record<string, SavedRequest[]>>({})
  const [collectionsError, setCollectionsError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  /** Dev-tool packages register more routes than the application does. */
  const [appOnly, setAppOnly] = useState(true)
  const [request, setRequest] = useState<ApiRequest>(blankRequest)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (container === null) {
      return
    }

    setRoutes([])
    setContexts([])
    void window.ray.getRoutes(container.id, container.workingDir).then(setRoutes)

    // A second, slower read: one scan covers every route, and the tab is
    // already usable before it lands.
    void window.ray.getRouteContexts(container.id, container.workingDir).then(setContexts)
  }, [container])

  const loadCollections = useCallback(async () => {
    if (container === null) {
      return
    }

    try {
      const answer = await window.ray.listCollections(container.id, container.workingDir)

      setCollections(answer.collections)
      setCollectionsError(answer.error)
      setSaved(Object.fromEntries(answer.collections.map((one) => [one.name, one.requests])))
    } catch (error) {
      setCollections([])
      setSaved({})
      setCollectionsError(
        error instanceof Error
          ? `${error.message}. If this app was running before it was last built, restart it.`
          : 'The collections could not be read.',
      )
    }
  }, [container])

  useEffect(() => {
    void loadCollections()
  }, [loadCollections])

  const environment = environments.find((one) => one.id === environmentId) ?? environments[0] ?? null

  const patch = useCallback((change: Partial<ApiRequest>) => {
    setRequest((current) => ({ ...current, ...change }))
  }, [])

  /**
   * Opening a route builds a request from it: its verb, its path, and one empty
   * box per `{parameter}` so the shape of what it needs is visible before you
   * have filled anything in.
   */
  const [route, setRoute] = useState<AppRoute | null>(null)
  /**
   * Which tab the request pane is showing. Up here rather than inside the pane
   * because filling a body has to be able to show you the body it filled —
   * otherwise the button looks like it did nothing.
   */
  const [tab, setTab] = useState<RequestTab>('params')
  /**
   * The token minted for whoever is being impersonated. Held here and nowhere
   * else: it is never written to disk, and it stops working on its own.
   */
  const [minted, setMinted] = useState<MintedToken | null>(null)

  const openRoute = useCallback((route: AppRoute) => {
    setResult(null)
    setRoute(route)
    setRequest((current) => ({
      ...blankRequest(),
      // Headers you have set are yours, and re-picking a route should not undo
      // them; everything else belongs to the route.
      headers: current.headers,
      name: route.name || route.uri,
      method: route.methods[0] ?? 'GET',
      path: route.uri.startsWith('/') ? route.uri : `/${route.uri}`,
      pathParams: pathParamNames(route.uri).map((key) => ({ key, value: '', enabled: true })),
      routeUri: route.uri,
    }))
  }, [])

  useEffect(() => {
    setMinted((current) =>
      current === null || current.userId === request.auth.userId ? current : null,
    )
  }, [request.auth.userId])

  const url = useMemo(
    () =>
      environment === null
        ? ''
        : buildUrl(environment.host, request.path, request.pathParams, request.query, environment.variables),
    [environment, request.path, request.pathParams, request.query],
  )

  const send = useCallback(async () => {
    if (environment === null || sending) {
      return
    }

    setSending(true)
    setResult(null)

    try {
      const headers = request.headers
        .filter((header) => header.enabled && header.key.trim() !== '')
        .map((header) => ({ key: header.key, value: resolve(header.value, environment.variables) }))

      const authorization = await authorize()

      if (authorization !== null) {
        headers.push({ key: 'Authorization', value: authorization })
      }

      const form =
        request.bodyMode === 'form'
          ? request.form
              .filter((field) => field.enabled && field.key.trim() !== '')
              .map((field) => ({
                key: field.key,
                value: resolve(field.value, environment.variables),
                file: field.file,
              }))
          : null

      setResult(
        await window.ray.sendApiRequest({
          environmentId: environment.id,
          method: request.method,
          url,
          headers,
          body: request.bodyMode === 'json' ? resolve(request.json, environment.variables) : null,
          form,
          insecure: environment.insecure,
          timeoutMs: SEND_TIMEOUT_MS,
        }),
      )
    } catch (error) {
      // Minting a token talks to the container and can fail for reasons that
      // have nothing to do with the request; saying nothing leaves the panel
      // looking as though Send was never pressed.
      setResult({
        status: 0,
        statusText: '',
        headers: [],
        body: '',
        size: 0,
        timing: { dns: 0, connect: 0, tls: 0, firstByte: 0, download: 0, total: 0 },
        debugId: '',
        error:
          error instanceof Error
            ? `${error.message}. If this app was running before it was last built, restart it.`
            : 'The request could not be sent.',
      })
    } finally {
      setSending(false)
    }
  }, [environment, request, sending, url])

  const ours = useMemo(() => routes.filter(isOurs), [routes])
  /** What the route currently open expects of a request, when anything knows. */
  const context = useMemo(
    () =>
      request.routeUri === ''
        ? null
        : (contexts.find(
            (one) => one.uri === request.routeUri && one.methods.includes(request.method),
          ) ??
          contexts.find((one) => one.uri === request.routeUri) ??
          null),
    [contexts, request.routeUri, request.method],
  )

  /**
   * The Authorization header, or null when the request carries none.
   *
   * A minted token is reused until it expires rather than minted per send: one
   * per press would leave a trail of rows in the tenant's database and add a
   * second to every call.
   */
  const authorize = useCallback(async (): Promise<string | null> => {
    if (environment === null || request.auth.mode === 'none') {
      return null
    }

    if (request.auth.mode === 'bearer') {
      const value = environment.variables.find((one) => one.key === request.auth.variable)?.value

      return value === undefined || value === '' ? null : `Bearer ${value}`
    }

    if (container === null || request.auth.userId === '') {
      return null
    }

    const tenant = resolve('{{ tenant }}', environment.variables)
    const fresh =
      minted !== null && minted.token !== '' && minted.expiresAt > Date.now() + 30_000
        ? minted
        : await window.ray.mintApiToken(
            container.id,
            container.workingDir,
            tenant === '{{ tenant }}' ? '' : tenant,
            request.auth.userId,
          )

    setMinted(fresh)

    return fresh.token === '' ? null : `Bearer ${fresh.token}`
  }, [container, environment, minted, request.auth])

  /** The request as the package stores it: references, never resolved values. */
  const asSaved = useCallback(
    (name: string): SavedRequest => ({
      name: name === '' ? request.name : name,
      method: request.method,
      path: request.path,
      pathParams: request.pathParams,
      query: request.query,
      headers: request.headers,
      bodyMode: request.bodyMode,
      json: request.json,
      // The mode travels; who was impersonated does not. A colleague's name and
      // id in a committed file is somebody's data in somebody else's git log.
      auth: request.auth.mode,
      summary: '',
    }),
    [request],
  )

  const shownRoutes = useMemo(
    () => filterRoutes(appOnly ? ours : routes, query),
    [appOnly, ours, routes, query],
  )

  return {
    environments,
    environment,
    environmentId: environment?.id ?? '',
    setEnvironmentId,
    saveEnvironments: useCallback((list: ApiEnvironment[]) => {
      setEnvironments(list)
      window.ray.writeEnvironments(list)
    }, []),
    routes,
    contexts,
    context,
    ours,
    appOnly,
    setAppOnly,
    shownRoutes,
    groups: useMemo(() => groupRoutes(shownRoutes), [shownRoutes]),
    query,
    setQuery,
    request,
    patch,
    route,
    collections,
    saved,
    collectionsError,
    loadCollections,
    saveTo: useCallback(
      async (collection: string, name: string) => {
        if (container === null) {
          return null
        }

        const answer = await window.ray.saveToCollection(
          container.id,
          container.workingDir,
          collection,
          asSaved(name),
        )

        await loadCollections()

        return answer
      },
      [asSaved, container, loadCollections],
    ),
    forgetSaved: useCallback(
      async (collection: string, operationId: string) => {
        if (container === null) {
          return
        }

        await window.ray.forgetInCollection(
          container.id,
          container.workingDir,
          collection,
          operationId,
        )
        await loadCollections()
      },
      [container, loadCollections],
    ),
    /** Opening a saved request puts every box back the way it was saved. */
    openSaved: useCallback((one: SavedRequest) => {
      setResult(null)
      setRoute(null)
      setRequest({
        ...blankRequest(),
        name: one.name,
        method: one.method,
        path: one.path,
        pathParams: one.pathParams,
        query: one.query,
        headers: one.headers,
        bodyMode: one.bodyMode,
        json: one.json,
        auth: { mode: one.auth, variable: 'token', userId: '', userLabel: '' },
      })
    }, []),
    container,
    /** The tenant the environment resolves to, which is where users live. */
    tenant: environment === null ? '' : resolvedTenant(environment.variables),
    minted,
    revoke: useCallback(async () => {
      if (container === null || environment === null) {
        return 0
      }

      const tenant = resolve('{{ tenant }}', environment.variables)
      const gone = await window.ray.revokeApiTokens(
        container.id,
        container.workingDir,
        tenant === '{{ tenant }}' ? '' : tenant,
      )

      setMinted(null)

      return gone
    }, [container, environment]),
    tab,
    setTab,
    reset: useCallback(() => {
      setRequest(blankRequest())
      setResult(null)
      setRoute(null)
    }, []),
    /** Turns the DTO's shape into a starting body, and switches to it. */
    fillBody: useCallback(
      (all: boolean) => {
        if (context === null) {
          return
        }

        setRequest((current) => ({
          ...current,
          bodyMode: 'json',
          json: bodySkeleton(context.fields, all),
        }))
        setTab('body')
      },
      [context],
    ),
    openRoute,
    url,
    result,
    sending,
    send,
  }
}

/**
 * Whether a route is the application's, rather than something a package
 * mounted.
 *
 * Horizon and Telescope between them register a hundred and ten of this
 * project's two hundred and ten routes, and none of them is what anyone opens
 * this tab to call — so the route you want is on the far side of a scroll bar
 * from the moment the list loads.
 */
export function isOurs(route: AppRoute): boolean {
  return route.action.startsWith('App\\') || route.action === 'Closure'
}

/** `{{ tenant }}` is the one variable the rest of the app has to know about. */
function resolvedTenant(variables: ApiEnvironment['variables']): string {
  const value = resolve('{{ tenant }}', variables)

  return value === '{{ tenant }}' ? '' : value
}

export function filterRoutes(routes: AppRoute[], query: string): AppRoute[] {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return routes
  }

  return routes.filter((route) =>
    `${route.methods.join(' ')} ${route.uri} ${route.name} ${route.action}`
      .toLowerCase()
      .includes(needle),
  )
}

export type RouteGroup = {
  prefix: string
  routes: AppRoute[]
}

/**
 * Two hundred routes in one list is a scroll bar, not a menu. The first segment
 * of the path is what people already call them by — "the desks endpoints" —
 * so that is what they are grouped under.
 */
export function groupRoutes(routes: AppRoute[]): RouteGroup[] {
  const byPrefix = new Map<string, AppRoute[]>()

  for (const route of routes) {
    const prefix = route.uri.split('/').filter((part) => part !== '')[0] ?? '/'
    const list = byPrefix.get(prefix) ?? []

    list.push(route)
    byPrefix.set(prefix, list)
  }

  return [...byPrefix.entries()]
    .map(([prefix, group]) => ({ prefix, routes: group }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix))
}
