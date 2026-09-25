/**
 * The shape a collector has to produce. Nothing collects this yet — the view
 * runs on fixtures — but writing it as the contract keeps the UI from having to
 * change when a real source arrives.
 */
export type HttpRequest = {
  id: string
  method: string
  /** Host the request hit, so a cURL command can be rebuilt. */
  host: string
  uri: string
  status: number
  /** Epoch milliseconds at which the request started. */
  startedAt: number
  durationMs: number
  memoryMb: number | null
  route: RouteInfo | null
  /** The request's own query string, flattened to bracketed keys. */
  queryParameters: KeyValue[]
  /** Credentials arrive already masked; the collector never ships them. */
  headers: KeyValue[]
  /** Whatever the application put on Laravel's Context. */
  context: KeyValue[]
  responseHeaders: KeyValue[]
  /** JSON only, capped; null for anything else. */
  responseBody: string | null
  session: KeyValue[]
  /** One entry per guard somebody is signed in with. */
  auth: KeyValue[]
  events: FiredEvent[]
  cache: CacheOperation[]
  queries: Query[]
  /** Debugbar's timeline measures, in the order they started. */
  timeline: Measure[]
  /** Counts for the collector tabs that have no screen yet. */
  collectorCounts: Record<string, number>
}

/**
 * One span on the request's timeline. Debugbar emits these for booting and the
 * application itself, and for whichever collectors have their `timeline` option
 * on — queries today.
 */
export type Measure = {
  label: string
  /** Milliseconds into the request at which the span began. */
  offsetMs: number
  durationMs: number
  /** The collector that produced it: `time`, `queries`, `views`, … */
  collector: string
  /** Debugbar's own grouping label, e.g. "Database Query". */
  group: string | null
}

export type KeyValue = { key: string; value: string }

/** The route a request matched, as the Route tab shows it. */
export type RouteInfo = {
  uri: string | null
  methods: string[]
  name: string | null
  action: string | null
  /** Where the action lives, as `app/Http/…php:31-56`. */
  file: string | null
  prefix: string | null
  domain: string | null
  parameters: KeyValue[]
  throttle: string | null
  middleware: MiddlewareEntry[]
}

export type MiddlewareEntry = {
  /** The class' short name, plus any parameters it was given. */
  name: string
  class: string | null
}

/** An event name, folded across every time the request dispatched it. */
export type FiredEvent = {
  name: string
  count: number
  /** Milliseconds into the request at which it first fired. */
  offsetMs: number
  /** Class names of the listeners; closures have no name worth showing. */
  listeners: string[]
}

export type CacheOperation = {
  /** debugbar's verbs: hit, missed, written, forgotten. */
  operation: string
  key: string
  store: string
  tags: string[]
  offsetMs: number
  durationMs: number
}

export type Query = {
  sql: string
  bindings: string[]
  durationMs: number
  /** Milliseconds into the request at which the query ran, for the timeline. */
  offsetMs: number
  source: string
  connection: string
  explain: string[][] | null
  hint: string | null
  trace: QueryFrame[]
}

export type QueryFrame = {
  callable: string
  file: string
  application: boolean
}

export type RequestFilter = 'all' | 'errors' | 'slow' | 'n1' | 'options'

/**
 * CORS preflights outnumber the calls they precede and carry no queries, so
 * they are kept out of every other filter and reachable only through their own.
 */
export function isPreflight(request: HttpRequest): boolean {
  return request.method.toUpperCase() === 'OPTIONS'
}

/** The canvas calls a request slow at this point. */
export const SLOW_REQUEST_MS = 200

/** And a query, matching the canvas' default threshold. */
export const SLOW_QUERY_MS = 100

/** Queries repeated with different bindings from one source are the N+1 signal. */
export function duplicateQueries(request: HttpRequest): Query[] {
  const counts = new Map<string, number>()

  for (const query of request.queries) {
    const key = `${query.sql}|${query.source}`

    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return request.queries.filter((query) => (counts.get(`${query.sql}|${query.source}`) ?? 0) > 1)
}

export function hasNPlusOne(request: HttpRequest): boolean {
  return duplicateQueries(request).length > 0
}

/** How often this exact statement repeats from this exact source. */
export function repeatCount(request: HttpRequest, query: Query): number {
  return request.queries.filter(
    (other) => other.sql === query.sql && other.source === query.source,
  ).length
}

/** The worst repeated statement, which is what the N+1 warning is about. */
export function worstRepeat(request: HttpRequest): { query: Query; count: number } | null {
  let worst: { query: Query; count: number } | null = null

  for (const query of request.queries) {
    const count = repeatCount(request, query)

    if (count > 1 && (worst === null || count > worst.count)) {
      worst = { query, count }
    }
  }

  return worst
}
