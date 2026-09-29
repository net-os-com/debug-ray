import { ArtisanPanel } from './artisan-panel'
import { LogsPanel } from './logs-panel'
import { QueuesPanel } from './queues-panel'
import { SchemaPanel } from './schema-panel'
import { ScoutPanel } from './scout-panel'
import { TestsPanel } from './tests-panel'
import type { ArtisanState } from './use-artisan'
import type { LogsState } from './use-logs'
import type { QueuesState } from './use-queues'
import type { SchemaState } from './use-schema'
import type { ScoutState } from './use-scout'
import type { TestsState } from './use-tests'

export type ToolKey = 'artisan' | 'logs' | 'queues' | 'schema' | 'scout' | 'tests'

const TOOLS: { key: ToolKey; label: string }[] = [
  { key: 'artisan', label: 'Artisan' },
  { key: 'logs', label: 'Logs' },
  { key: 'queues', label: 'Queues' },
  { key: 'schema', label: 'Schema' },
  { key: 'scout', label: 'Scout' },
  { key: 'tests', label: 'Tests' },
]

type ToolsViewProps = {
  artisan: ArtisanState
  logs: LogsState
  queues: QueuesState
  schema: SchemaState
  scout: ScoutState
  tenants: string[]
  tests: TestsState
  tool: ToolKey
  onSelectTool: (tool: ToolKey) => void
}

export function ToolsView({
  artisan,
  logs,
  queues,
  schema,
  scout,
  tenants,
  tests,
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
      {tool === 'queues' ? <QueuesPanel queues={queues} /> : null}
      {tool === 'schema' ? <SchemaPanel schema={schema} tenants={tenants} /> : null}
      {tool === 'scout' ? <ScoutPanel scout={scout} tenants={tenants} /> : null}
      {tool === 'tests' ? <TestsPanel tests={tests} /> : null}
    </div>
  )
}
