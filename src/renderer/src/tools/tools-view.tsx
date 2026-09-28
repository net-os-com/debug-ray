import { ArtisanPanel } from './artisan-panel'
import { LogsPanel } from './logs-panel'
import { ScoutPanel } from './scout-panel'
import type { ArtisanState } from './use-artisan'
import type { LogsState } from './use-logs'
import type { ScoutState } from './use-scout'

export type ToolKey = 'artisan' | 'logs' | 'scout'

const TOOLS: { key: ToolKey; label: string }[] = [
  { key: 'artisan', label: 'Artisan' },
  { key: 'logs', label: 'Logs' },
  { key: 'scout', label: 'Scout' },
]

type ToolsViewProps = {
  artisan: ArtisanState
  logs: LogsState
  scout: ScoutState
  tenants: string[]
  tool: ToolKey
  onSelectTool: (tool: ToolKey) => void
}

export function ToolsView({
  artisan,
  logs,
  scout,
  tenants,
  tool,
  onSelectTool,
}: ToolsViewProps) {
  return (
    <div className="tools">
      <nav className="tools__rail">
        <span className="pane__label">Tools</span>

        {TOOLS.map((entry) => (
          <button
            className={entry.key === tool ? 'tools__item tools__item--on' : 'tools__item'}
            key={entry.key}
            onClick={() => onSelectTool(entry.key)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tool === 'artisan' ? <ArtisanPanel artisan={artisan} /> : null}
      {tool === 'logs' ? <LogsPanel logs={logs} /> : null}
      {tool === 'scout' ? <ScoutPanel scout={scout} tenants={tenants} /> : null}
    </div>
  )
}
