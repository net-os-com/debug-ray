/**
 * The payload type the Laravel side sends one finished HTTP request under. It
 * carries debugbar's data rather than a ray() call, so it is routed to the
 * Requests view instead of the stream.
 */
export const REQUEST_PAYLOAD_TYPE = 'netos_request'

/**
 * The payload type one outgoing HTTP call arrives under: a call the application
 * made, rather than one it answered.
 */
export const HTTP_CLIENT_PAYLOAD_TYPE = 'netos_http_client'

/**
 * Payloads that annotate another event rather than being one: `ray()->label()`,
 * `->color()`, `->confetti()`. They carry no headline of their own.
 */
export const ANNOTATION_TYPES = new Set(['label', 'color', 'confetti'])

/**
 * Everything that is not a stream entry.
 *
 * Collected HTTP requests are their own view, and one of them outweighs a
 * hundred log payloads. They stay in the buffer so the API can fetch one by id,
 * but they are kept out of listings so an MCP client asking for recent events is
 * not handed a wall of SQL — and out of notifications, which would otherwise
 * fire once per page load.
 *
 * Shared because the main process' buffer and the renderer both filter on it,
 * and two copies of this list would drift.
 */
/**
 * Payloads that have a view of their own, and so never appear in the stream.
 *
 * One page load can make a dozen outgoing calls and one collected request can
 * carry a hundred queries; a stream that buries a dump under either is a stream
 * nobody reads. Both are kept in the buffer — the API can fetch one by id — and
 * out of the list.
 */
export const OWN_VIEW = new Set([REQUEST_PAYLOAD_TYPE, HTTP_CLIENT_PAYLOAD_TYPE])

export const OUT_OF_STREAM = new Set([...ANNOTATION_TYPES, ...OWN_VIEW])

/** The `origin` block every ray payload carries: where the ray() call sat. */
export type RayOrigin = {
  file: string | null
  line_number: number | string | null
  hostname: string | null
}

export type RayPayload = {
  type: string
  content: Record<string, unknown>
  origin: RayOrigin
}

/** The JSON body the PHP client POSTs to `/`. */
export type RayRequest = {
  uuid: string
  payloads: RayPayload[]
  meta: Record<string, unknown>
}

/** One payload, flattened together with the request context it arrived in. */
export type RayEvent = {
  id: string
  uuid: string
  receivedAt: number
  type: string
  content: Record<string, unknown>
  origin: RayOrigin
  meta: Record<string, unknown>
}

/**
 * Whether an event is a row in the stream.
 *
 * `clear_all` is not one: it is an instruction to empty the stream, which
 * every listener acts on rather than shows. Shared because the main process
 * decides from this when the menu bar icon pulses and what a late window is
 * handed, and the renderer must agree on both.
 */
export function isStreamEntry(event: RayEvent): boolean {
  return !OUT_OF_STREAM.has(event.type) && event.type !== 'clear_all'
}

/**
 * What the main process holds for the stream, handed to a window that opens
 * after the events arrived: the menu bar panel, or a main window that was
 * closed and opened again.
 */
export type StreamSnapshot = {
  /** Oldest first, the order events arrive in. Never contains `clear_all`. */
  events: RayEvent[]
  /** `ray()->label()` per request uuid. */
  labels: Record<string, string>
  /** `ray()->color()` per request uuid. */
  colors: Record<string, string>
}

export type ServerStatus = {
  listening: boolean
  host: string
  port: number
  error: string | null
}

/** A sender we have seen post payloads, for the settings view. */
export type RayClient = {
  id: string
  label: string
  address: string
  lastSeenAt: number
}

/** Whether a Claude Code MCP session is currently talking to the receiver. */
export type McpStatus = {
  connected: boolean
  lastSeenAt: number | null
  /** Absolute path to mcp/server.mjs, or null when it is not on disk. */
  serverPath: string | null
}

/** Where a pending application update has got to. */
export type UpdateStatus = {
  phase: 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error'
  version: string | null
  /** 0–100 while downloading. */
  percent: number
  error: string | null
}
