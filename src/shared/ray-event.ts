/**
 * The payload type the Laravel side sends one finished HTTP request under. It
 * carries debugbar's data rather than a ray() call, so it is routed to the
 * Requests view instead of the stream.
 */
export const REQUEST_PAYLOAD_TYPE = 'netos_request'

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
