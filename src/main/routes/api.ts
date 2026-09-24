import type { IncomingMessage, ServerResponse } from 'node:http'
import type { EventLog } from '../event-log'
import type { McpPresence } from '../mcp-status'
import { respondJson } from '../respond-json'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 200

/**
 * The receiver binds 0.0.0.0 so containers can reach it, which would otherwise
 * expose everything your app dumps to the whole network. Reading is therefore
 * restricted to this machine.
 */
function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Read-only endpoints behind the MCP server. */
export function api(
  req: IncomingMessage,
  res: ServerResponse,
  log: EventLog,
  presence: McpPresence,
): void {
  if (!isLoopback(req.socket.remoteAddress)) {
    respondJson(res, 403, { message: 'The API is only available from this machine' })

    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname

  if (path === '/api/mcp/heartbeat') {
    presence.record()
    respondJson(res, 200, { ok: true })

    return
  }

  if (path === '/api/events') {
    const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)
    const type = url.searchParams.get('type') ?? undefined

    respondJson(res, 200, { events: log.recent(limit, type).map((event) => decorate(event, log)) })

    return
  }

  if (path === '/api/last-exception') {
    const event = log.lastException()

    respondJson(res, event ? 200 : 404, event ? decorate(event, log) : { message: 'No exception received yet' })

    return
  }

  const match = /^\/api\/events\/([^/]+)$/.exec(path)

  if (match) {
    const event = log.get(match[1])

    respondJson(res, event ? 200 : 404, event ?? { message: 'No such event' })

    return
  }

  respondJson(res, 404, { message: 'Not found' })
}

function decorate(event: ReturnType<EventLog['recent']>[number], log: EventLog) {
  return { ...event, ...log.annotationsFor(event.uuid) }
}
