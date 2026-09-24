import { useMcpStatus } from '../use-mcp-status'

/**
 * Sits under the buffer card. Doubles as the way into its settings, since that
 * is where you go the moment it says it is not connected.
 */
export function McpIndicator({ onOpenSettings }: { onOpenSettings: () => void }) {
  const status = useMcpStatus()

  return (
    <button
      className={status?.connected ? 'mcp-indicator mcp-indicator--on' : 'mcp-indicator'}
      onClick={onOpenSettings}
      title="MCP settings"
      type="button"
    >
      <span className="mcp-indicator__dot" />
      <span className="mcp-indicator__label">Claude Code</span>
      <span className="mcp-indicator__state">
        {status === null ? '…' : status.connected ? 'connected' : 'off'}
      </span>
    </button>
  )
}
