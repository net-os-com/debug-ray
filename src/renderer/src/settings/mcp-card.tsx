import type { McpStatus } from '../../../shared/ray-event'
import { CopyButton } from '../ui/copy-button'
import { useMcpStatus } from '../use-mcp-status'

const TOOLS = 'list_ray_events · get_last_exception · get_ray_event'

export function McpCard() {
  const status = useMcpStatus()

  // The packaged app does not ship the MCP server, so there is no absolute
  // path to offer — but the command is still the thing you came here for, and
  // it reads the same from a checkout.
  const command =
    status === null
      ? null
      : `claude mcp add netos-ray -- node ${status.serverPath ?? 'mcp/server.mjs'}`

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
          <div className="card__note">{note(status)}</div>
        </>
      ) : null}

      <div className="card__note">Tools: {TOOLS}</div>
    </div>
  )
}

function note(status: McpStatus | null): string {
  if (status?.connected) {
    return 'Already set up. Re-run it only if you move the checkout.'
  }

  if (status?.serverPath) {
    return 'Run it once, then restart your Claude Code session.'
  }

  return 'Run it from a checkout of the repository — the packaged app does not ship the MCP server — then restart your Claude Code session.'
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
