import { useEffect, useState } from 'react'
import type { McpStatus } from '../../../shared/ray-event'
import { CopyButton } from '../ui/copy-button'

const TOOLS = 'list_ray_events · get_last_exception · get_ray_event'

export function McpCard() {
  const [status, setStatus] = useState<McpStatus | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = (): void => {
      void window.ray.getMcpStatus().then((next) => {
        if (!cancelled) {
          setStatus(next)
        }
      })
    }

    load()

    const timer = setInterval(load, 3000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const command = status?.serverPath
    ? `claude mcp add netos-ray -- node ${status.serverPath}`
    : null

  return (
    <div className="card">
      <div className="card__head">
        <div className="card__title">Claude Code</div>
        <div className={status?.connected ? 'mcp-status mcp-status--on' : 'mcp-status'}>
          <span className="mcp-status__dot" />
          {statusLabel(status)}
        </div>
      </div>

      <div className="card__body">
        Let a Claude Code session read payloads straight from this app, so you can ask about the
        last exception without copying anything.
      </div>

      {command ? (
        <>
          <div className="mcp-command">
            <code>{command}</code>
            <CopyButton label="Copy" text={command} />
          </div>
          <div className="card__note">Run it once, then restart your Claude Code session.</div>
        </>
      ) : (
        <div className="card__note">
          The MCP server ships with the source checkout, not with the packaged app. Clone the
          repository and run <code>claude mcp add netos-ray -- node mcp/server.mjs</code> from it.
        </div>
      )}

      <div className="card__note">Tools: {TOOLS}</div>
    </div>
  )
}

function statusLabel(status: McpStatus | null): string {
  if (!status) {
    return 'Checking…'
  }

  if (status.connected) {
    return 'Connected'
  }

  return status.lastSeenAt ? `Not connected · last seen ${ago(status.lastSeenAt)}` : 'Not connected'
}

function ago(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000)

  return minutes < 1 ? 'just now' : `${minutes}m ago`
}
