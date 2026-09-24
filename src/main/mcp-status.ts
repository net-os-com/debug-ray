import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { McpStatus } from '../shared/ray-event'

/** A heartbeat older than this means the MCP process is gone. */
const STALE_AFTER_MS = 30_000

/**
 * Nothing about a stdio MCP server is observable from here — Claude Code spawns
 * it, not us. So the server announces itself on start and every few seconds,
 * and "connected" means we heard from it recently.
 */
export class McpPresence {
  private lastSeenAt: number | null = null

  record(): void {
    this.lastSeenAt = Date.now()
  }

  status(): McpStatus {
    const fresh = this.lastSeenAt !== null && Date.now() - this.lastSeenAt < STALE_AFTER_MS

    return {
      connected: fresh,
      lastSeenAt: this.lastSeenAt,
      serverPath: serverPath(),
    }
  }
}

/**
 * Only present in a source checkout; the packaged app does not ship the MCP
 * server or its dependencies.
 */
function serverPath(): string | null {
  const path = join(import.meta.dirname, '../../mcp/server.mjs')

  return existsSync(path) ? path : null
}
