import type { RayClient, RayRequest } from '../shared/ray-event'

const FORGET_AFTER_MS = 30 * 60 * 1000

/**
 * Ray has no handshake, so "connected clients" is derived from who has been
 * posting: the origin hostname plus the socket address it came from.
 */
export class Clients {
  private byId = new Map<string, RayClient>()

  record(request: RayRequest, address: string): void {
    const hostname = request.payloads?.[0]?.origin?.hostname ?? 'unknown host'
    const project = typeof request.meta?.project_name === 'string' ? request.meta.project_name : null
    const php = typeof request.meta?.php_version === 'string' ? request.meta.php_version : null

    const id = `${hostname}|${address}`

    this.byId.set(id, {
      id,
      label: project ? `${project} · ${hostname}` : hostname,
      address: php ? `${address} · PHP ${php}` : address,
      lastSeenAt: Date.now(),
    })
  }

  list(): RayClient[] {
    const cutoff = Date.now() - FORGET_AFTER_MS

    for (const [id, client] of this.byId) {
      if (client.lastSeenAt < cutoff) {
        this.byId.delete(id)
      }
    }

    return [...this.byId.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  }
}
