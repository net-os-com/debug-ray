import { BufferCard } from './buffer-card'
import { FilterGroup, type FilterOption } from './filter-group'
import { LabelFilter } from './label-filter'
import { McpIndicator } from './mcp-indicator'

type SidebarProps = {
  sources: FilterOption[]
  kinds: FilterOption[]
  labels: FilterOption[]
  active: { source: string; kind: string; label: string }
  onSelect: (group: 'source' | 'kind' | 'label', key: string) => void
  onOpenSettings: () => void
  total: number
}

export function Sidebar({
  sources,
  kinds,
  labels,
  active,
  onSelect,
  onOpenSettings,
  total,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <FilterGroup
        active={active.source}
        onSelect={(key) => onSelect('source', key)}
        options={sources}
        title="Sources"
      />
      <FilterGroup
        active={active.kind}
        onSelect={(key) => onSelect('kind', key)}
        options={kinds}
        title="Types"
      />
      <LabelFilter
        active={active.label}
        onSelect={(key) => onSelect('label', key)}
        options={labels}
      />
      <BufferCard count={total} />

      <McpIndicator onOpenSettings={onOpenSettings} />
    </aside>
  )
}
