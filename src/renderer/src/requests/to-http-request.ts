import type {
  CacheOperation,
  FiredEvent,
  HttpRequest,
  KeyValue,
  Measure,
  MiddlewareEntry,
  Query,
  QueryFrame,
  RouteInfo,
} from './types'

/**
 * Turns one `netos_request` payload into the view's contract.
 *
 * The sender is a debugbar version we do not control, so nothing here trusts
 * the shape: a payload that has drifted is dropped rather than rendered as a
 * row full of `undefined`. Returning null is the signal to ignore it.
 */
export function toHttpRequest(content: Record<string, unknown>): HttpRequest | null {
  const id = text(content.id)
  const method = text(content.method)

  if (id === null || method === null) {
    return null
  }

  return {
    id,
    method,
    host: text(content.host) ?? '',
    uri: text(content.uri) ?? '',
    status: number(content.status) ?? 0,
    startedAt: number(content.startedAt) ?? Date.now(),
    durationMs: number(content.durationMs) ?? 0,
    memoryMb: number(content.memoryMb),
    route: route(content.route),
    queryParameters: pairs(content.queryParameters),
    headers: pairs(content.headers),
    context: pairs(content.context),
    responseHeaders: pairs(content.responseHeaders),
    responseBody: text(content.responseBody),
    session: pairs(content.session),
    auth: pairs(content.auth),
    events: events(content.events),
    cache: cache(content.cache),
    queries: queries(content.queries),
    timeline: timeline(content.timeline),
    collectorCounts: counts(content.collectorCounts),
  }
}

function route(value: unknown): RouteInfo | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    uri: text(value.uri),
    methods: strings(value.methods),
    name: text(value.name),
    action: text(value.action),
    file: text(value.file),
    prefix: text(value.prefix),
    domain: text(value.domain),
    parameters: pairs(value.parameters),
    throttle: text(value.throttle),
    middleware: middleware(value.middleware),
  }
}

function pairs(value: unknown): KeyValue[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((entry) => ({ key: String(entry.key ?? ''), value: String(entry.value ?? '') }))
    .filter((entry) => entry.key !== '')
}

function middleware(value: unknown): MiddlewareEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((entry) => ({ name: text(entry.name) ?? '', class: text(entry.class) }))
    .filter((entry) => entry.name !== '')
}

function events(value: unknown): FiredEvent[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((entry) => ({
      name: text(entry.name) ?? '',
      count: number(entry.count) ?? 1,
      offsetMs: number(entry.offsetMs) ?? 0,
      listeners: strings(entry.listeners),
    }))
    .filter((entry) => entry.name !== '')
}

function cache(value: unknown): CacheOperation[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((entry) => ({
      operation: text(entry.operation) ?? '',
      key: text(entry.key) ?? '',
      store: text(entry.store) ?? '',
      tags: strings(entry.tags),
      offsetMs: number(entry.offsetMs) ?? 0,
      durationMs: number(entry.durationMs) ?? 0,
    }))
    .filter((entry) => entry.operation !== '')
}

function timeline(value: unknown): Measure[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((entry) => ({
    label: text(entry.label) ?? '',
    offsetMs: number(entry.offsetMs) ?? 0,
    durationMs: number(entry.durationMs) ?? 0,
    collector: text(entry.collector) ?? '',
    group: text(entry.group),
  }))
}

function queries(value: unknown): Query[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((entry) => ({
    sql: text(entry.sql) ?? '',
    bindings: strings(entry.bindings),
    durationMs: number(entry.durationMs) ?? 0,
    offsetMs: number(entry.offsetMs) ?? 0,
    source: text(entry.source) ?? '',
    connection: text(entry.connection) ?? '',
    explain: explain(entry.explain),
    hint: text(entry.hint),
    trace: trace(entry.trace),
  }))
}

function trace(value: unknown): QueryFrame[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((frame) => ({
    callable: text(frame.callable) ?? '',
    file: text(frame.file) ?? '',
    application: frame.application === true,
  }))
}

/** Rows of cells, as an EXPLAIN table. Anything else is treated as absent. */
function explain(value: unknown): string[][] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.filter(Array.isArray).map((row) => row.map((cell) => String(cell)))
}

function counts(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {}
  }

  const counted: Record<string, number> = {}

  for (const [key, entry] of Object.entries(value)) {
    const count = number(entry)

    if (count !== null) {
      counted[key] = count
    }
  }

  return counted
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
