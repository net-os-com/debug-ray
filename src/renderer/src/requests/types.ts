/**
 * The shape a collector has to produce. Nothing collects this yet — the view
 * runs on fixtures — but writing it as the contract keeps the UI from having to
 * change when a real source arrives.
 */
export type HttpRequest = {
  id: string
  method: string
  uri: string
  status: number
  /** Epoch milliseconds at which the request started. */
  startedAt: number
  durationMs: number
  memoryMb: number | null
  route: string | null
  action: string | null
  middleware: string[]
  queries: Query[]
  /** Counts for the collector tabs that have no screen yet. */
  collectorCounts: Record<string, number>
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

export type RequestFilter = 'all' | 'errors' | 'slow' | 'n1'

/** The canvas calls a request slow at this point. */
export const SLOW_REQUEST_MS = 200

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
