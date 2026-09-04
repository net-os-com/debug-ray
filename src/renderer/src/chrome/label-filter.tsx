import type { FilterOption } from './filter-group'

type LabelFilterProps = {
  options: FilterOption[]
  active: string
  onSelect: (key: string) => void
}

export function LabelFilter({ options, active, onSelect }: LabelFilterProps) {
  return (
    <div>
      <div className="sidebar__heading">Labels</div>
      <div className="label-filter">
        {options.map((option) => (
          <button
            className={option.key === active ? 'label-pill label-pill--active' : 'label-pill'}
            key={option.key}
            onClick={() => onSelect(option.key)}
            type="button"
          >
            <span className="label-pill__dot" style={{ background: option.dot }} />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
