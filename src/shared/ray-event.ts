/**
 * The payload type the Laravel side sends one finished HTTP request under. It
 * carries debugbar's data rather than a ray() call, so it is routed to the
 * Requests view instead of the stream.
 */
export const REQUEST_PAYLOAD_TYPE = 'netos_request'

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
export const OUT_OF_STREAM = new Set([...ANNOTATION_TYPES, REQUEST_PAYLOAD_TYPE])

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
